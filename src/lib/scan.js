import * as ImagePicker from "expo-image-picker";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Photographing a page of handwritten notes.
 *
 * One photo is **one page**. A four-page set of notes is four materials, not
 * one with four pages — the server transcribes what is in the frame and indexes
 * it as a single page, and the tutor cites it as "page 1 of …".
 *
 * Everything a photo goes through before it is uploaded lives here, and none of
 * it is cosmetic. The two rules below are the difference between a scan that
 * works and one the server rejects *after* the student has already spent their
 * data uploading it — the worst possible order for a refusal to arrive in on a
 * Kenyan mobile connection.
 */

/**
 * The long edge, in pixels, and the JPEG quality.
 *
 * The scans bucket takes 25MB and the plan allows 50, but the vision model that
 * reads the page caps at 12MB — and a raw 12-megapixel photo can clear that on
 * its own. The refusal for an oversized image happens at extraction, which is
 * to say after the upload, so the only place to prevent it is here.
 *
 * 2000px is not a compromise on legibility: the model gains nothing above it,
 * and handwriting stays comfortably readable. What it buys is an upload that
 * finishes in seconds instead of minutes.
 */
const LONG_EDGE = 2000;
const QUALITY = 0.8;

/**
 * Whether this binary can actually resize an image.
 *
 * `expo-image-manipulator` is native, and an over-the-air update can deliver
 * JavaScript that calls it but cannot add native code to a build already on a
 * phone. Importing it unconditionally would therefore crash every existing
 * install on launch — the one failure that cannot be fixed from the server.
 *
 * `requireOptionalNativeModule` rather than a `try/catch` around the import,
 * because importing the package evaluates its native module and throws at
 * import time, before anything of ours runs. Asking first, by name, is the only
 * version of this check that can answer "no".
 */
const manipulator = requireOptionalNativeModule("ExpoImageManipulator");

/**
 * True where a photo can be downscaled and re-encoded before it is uploaded.
 *
 * Exported because the capture UI has to know: on a build without it, the
 * camera is not offered at all. That is not squeamishness about quality — the
 * camera permission arrives in the same store build as this module, so on any
 * binary missing one the other cannot work either.
 */
export const canPrepareScans = Boolean(manipulator);

// eslint-disable-next-line global-require
const imageManipulator = manipulator ? require("expo-image-manipulator") : null;

/**
 * Normalises whatever the camera produced into something the server can read.
 *
 * Two jobs, and the second one is the quiet killer. iPhones shoot HEIC by
 * default and no vision API reads it; the server refuses it with a useful
 * message, but only once the bytes have arrived. Re-encoding as JPEG here means
 * that refusal can never happen — the format the student's phone happens to be
 * set to stops being something they have to know about.
 *
 * Resolves to `{ uri, error }`. A failure here is worth reporting rather than
 * falling back to the original: passing the raw file through would restore
 * exactly the two failures this exists to prevent.
 */
export async function prepareScan(uri) {
  /**
   * Nothing to prepare with, so the picked file goes as it is.
   *
   * Reached only on a build that predates the module — an over-the-air update
   * running on an older binary. The picker's own compression has already been
   * applied, which usually lands under the server's 12MB ceiling, and where it
   * does not the server refuses with a sentence written for a student that the
   * card then shows. Degraded, and honest about it: the alternative is refusing
   * to file the photo at all on grounds the student cannot act on.
   */
  if (!imageManipulator) return { uri, error: null };

  try {
    const context = imageManipulator.ImageManipulator.manipulate(uri);

    // Width only. `height: null` keeps the ratio, and a page shot in portrait
    // and one shot in landscape both come out with their long edge bounded —
    // constraining a fixed height would upscale one of them.
    context.resize({ width: LONG_EDGE, height: null });

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: imageManipulator.SaveFormat.JPEG,
      compress: QUALITY,
    });

    return { uri: saved.uri, error: null };
  } catch {
    return {
      uri: null,
      error: "That photo could not be prepared for upload. Try taking it again.",
    };
  }
}

/**
 * The material payload a prepared photo becomes.
 *
 * `.jpg` and `image/jpeg` only where `prepareScan` actually made that true. On
 * a build that could not convert, the original type is reported instead — the
 * server checks the declared type against the bytes, and claiming JPEG over a
 * HEIC would turn a clear refusal ("Most Compatible saves photos as JPEG") into
 * a confusing one.
 */
function scanPayload(uri, title, asset) {
  if (!canPrepareScans) {
    return {
      kind: "image",
      title,
      filename: asset?.fileName ?? "photo.jpg",
      mimeType: asset?.mimeType ?? "image/jpeg",
      uri,
      body: "",
    };
  }

  return {
    kind: "image",
    title,
    filename: "scan.jpg",
    mimeType: "image/jpeg",
    uri,
    body: "",
  };
}

/**
 * Opens the camera, prepares what comes back.
 *
 * Resolves to `{ payload, error }`, or `{ payload: null, error: null }` when
 * the student backed out — a cancel is not a failure and must not raise
 * anything.
 *
 * No permission is requested up front. `launchCameraAsync` asks for what it
 * needs and returns a cancelled result if it is refused, which is one prompt
 * rather than two and leaves the decision where the student expects it.
 */
export async function captureScan(title = "Scanned page") {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    // Full quality only where `prepareScan` is going to re-encode anyway —
    // compressing twice is visibly worse than once, and handwriting is exactly
    // the fine detail that shows it. Without the manipulator this is the only
    // compression there will be, so it has to do the job itself.
    quality: canPrepareScans ? 1 : 0.7,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return { payload: null, error: null };

  const asset = result.assets[0];
  const { uri, error } = await prepareScan(asset.uri);
  if (error) return { payload: null, error };

  return { payload: scanPayload(uri, title, asset), error: null };
}

/**
 * The same, from the photo library.
 *
 * Kept beside the camera rather than reusing the generic image picker in
 * `AddKnowledge`: a photo of a page taken yesterday needs the identical
 * downscale and JPEG conversion, and a second path that skipped them would fail
 * in exactly the ways this file exists to prevent.
 */
export async function pickScan(title = "Scanned page") {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: canPrepareScans ? 1 : 0.7,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return { payload: null, error: null };

  const asset = result.assets[0];
  const { uri, error } = await prepareScan(asset.uri);
  if (error) return { payload: null, error };

  return {
    payload: scanPayload(
      uri,
      asset.fileName ? stripExtension(asset.fileName) : title,
      asset,
    ),
    error: null,
  };
}

/** `IMG_0421.HEIC` → `IMG_0421`. The extension is no longer true after prepare. */
function stripExtension(name) {
  return name.replace(/\.[^.]+$/, "");
}
