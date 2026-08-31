import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

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
  try {
    const context = ImageManipulator.manipulate(uri);

    // Width only. `height: null` keeps the ratio, and a page shot in portrait
    // and one shot in landscape both come out with their long edge bounded —
    // constraining a fixed height would upscale one of them.
    context.resize({ width: LONG_EDGE, height: null });

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
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

/** The material payload a prepared photo becomes. */
function scanPayload(uri, title) {
  return {
    kind: "image",
    title,
    // Always `.jpg` and `image/jpeg`, because `prepareScan` has just made that
    // true whatever the camera produced. Reporting the original's type here
    // would describe a file that no longer exists.
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
    // Full quality out of the camera, because `prepareScan` is what decides the
    // final size. Compressing twice is visibly worse than compressing once, and
    // handwriting is exactly the sort of fine detail that shows it.
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return { payload: null, error: null };

  const { uri, error } = await prepareScan(result.assets[0].uri);
  if (error) return { payload: null, error };

  return { payload: scanPayload(uri, title), error: null };
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
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return { payload: null, error: null };

  const asset = result.assets[0];
  const { uri, error } = await prepareScan(asset.uri);
  if (error) return { payload: null, error };

  return {
    payload: scanPayload(uri, asset.fileName ? stripExtension(asset.fileName) : title),
    error: null,
  };
}

/** `IMG_0421.HEIC` → `IMG_0421`. The extension is no longer true after prepare. */
function stripExtension(name) {
  return name.replace(/\.[^.]+$/, "");
}
