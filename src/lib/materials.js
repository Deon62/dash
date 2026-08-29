import * as WebBrowser from "expo-web-browser";

import { materials as materialsApi } from "@/api/endpoints";
import { OFFLINE } from "@/api/client";
import { authed } from "@/lib/session";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * Getting a file onto the account.
 *
 * Three steps, and the middle one does not touch the API: ask the server for a
 * signed URL, put the bytes straight into Supabase Storage, then tell the
 * server they landed. Routing a 50MB slide deck through the API instead would
 * hold a worker for the length of the upload on campus wifi, which is the
 * fastest way to make a healthy service look dead.
 *
 * The material row exists locally before any of this, so a student sees what
 * they added immediately and the upload catches up. `uploadStatus` on the row
 * is what the screens read to say where it has got to.
 *
 * The bytes are read off disk with `fetch("file://…")`, which React Native
 * answers from its own networking layer, and PUT to the signed URL as a raw
 * body with the file's content type. That is the shape Supabase Storage
 * documents for a direct upload, and it is chosen over a `multipart/form-data`
 * descriptor deliberately: multipart would stream from disk without holding
 * the file in memory, but React Native has a long history of producing
 * zero-byte multipart uploads against this exact endpoint, and a file that
 * uploads "successfully" as nothing is far worse than one that costs some
 * memory. The plan caps a single file at 50MB, which a phone can hold.
 *
 * Reading it first also settles the size question. `expo-image-picker` does
 * not always report `fileSize` — it is routinely undefined on Android — and
 * the server needs a real byte count to check the plan's file limit before it
 * will sign anything. Measuring the blob is the only way to know rather than
 * guess.
 */

/** What the picker reports, mapped to what the server files it as. */
const MIME = {
  pdf: "application/pdf",
  image: "image/jpeg",
};

/**
 * How long a file has to finish uploading.
 *
 * Generous, because this is a big body on a phone connection — but not
 * unbounded: a stalled upload that never settles leaves an item stuck on
 * "Uploading…" for the life of the install.
 */
const UPLOAD_TIMEOUT_MS = 180000;

/**
 * Reads a picked file into memory and measures it.
 *
 * Resolves to `{ blob, error }`. The URI comes from the system picker and
 * points at a file the app has already been granted, but it can still be gone
 * by the time an upload is retried — a cache the OS cleared, a photo deleted —
 * so this is allowed to fail and say so plainly.
 */
async function readFile(uri) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    if (!blob?.size) {
      return { blob: null, error: "That file is empty or could not be read." };
    }

    return { blob, error: null };
  } catch {
    return {
      blob: null,
      error: "That file is no longer on this phone, so it could not be sent.",
    };
  }
}

/**
 * Uploads one already-filed material's attachment.
 *
 * Returns `{ error }`. The row is marked `pending` or `failed` either way, so
 * a failed upload is visible on the item rather than being a silent no-op that
 * leaves the tutor quietly unable to read it.
 */
export async function uploadMaterial(material) {
  const { updateMaterial } = useStudyStore.getState();

  if (!material?.uri) return { error: null };

  const fail = (error) => {
    updateMaterial(material.id, { uploadStatus: "failed" });
    return { error };
  };

  const mimeType = material.mimeType ?? MIME[material.kind] ?? "application/octet-stream";
  const filename = material.filename ?? material.title;

  updateMaterial(material.id, { uploadStatus: "uploading" });

  // Read before asking for a URL. The size the server checks the plan against
  // has to be the real one, and the picker's own figure is missing often
  // enough that trusting it means refusing uploads that were always fine.
  const { blob, error: unreadable } = await readFile(material.uri);
  if (unreadable) return fail(unreadable);

  const byteSize = blob.size;

  const signed = await authed((token) =>
    materialsApi.uploadUrl(
      {
        materialId: material.id,
        unitId: material.unitId,
        kind: material.kind,
        filename,
        mimeType,
        byteSize,
      },
      token,
    ),
  );

  // The server refuses here — plan limit, file type, bucket ceiling — before a
  // single byte moves. Checking afterwards would be too late: the file is
  // already uploaded and has already cost the student their data.
  if (signed.error) return fail(signed.error);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(signed.data.upload_url, {
      method: "PUT",
      signal: controller.signal,
      headers: {
        "Content-Type": mimeType,
        // Storage rejects an overwrite by default, and a retry of an upload
        // that half-landed is exactly when that happens. The material id is
        // the object path, so replacing it is always the right answer.
        "x-upsert": "true",
      },
      body: blob,
    });

    if (!response.ok) {
      return fail(`The file could not be stored (${response.status}).`);
    }
  } catch (error) {
    return fail(
      error?.name === "AbortError"
        ? "That upload took too long and was stopped. It will be retried."
        : OFFLINE,
    );
  } finally {
    clearTimeout(timer);
  }

  const done = await authed((token) =>
    materialsApi.completeUpload({ materialId: material.id, title: material.title }, token),
  );

  if (done.error) return fail(done.error);

  updateMaterial(material.id, {
    // `pending` is honest: the file is stored, and its text is not searchable
    // until the server has read it.
    uploadStatus: done.data?.extraction_status ?? "pending",
    pageCount: done.data?.page_count ?? null,
  });

  return { error: null };
}

/**
 * A link to the stored file, good for a few minutes.
 *
 * Minted per request and expiring, because the buckets are private — which is
 * the whole reason not to serve coursework from a public one. Resolves to
 * `{ url, error }`.
 */
export async function materialUrl(materialId) {
  const { data, error } = await authed((token) =>
    materialsApi.downloadUrl(materialId, token),
  );

  if (error) return { url: null, error };
  return { url: data.url, error: null };
}

/**
 * Hands the file to the system browser.
 *
 * The fallback, not the way in: files are read in `MaterialViewer` without
 * leaving the app. This is what the viewer offers when it cannot render one —
 * a format it has no reader for, or a PDF whose pages refused to draw — so
 * that "we couldn't show it here" is never the end of the conversation.
 */
export async function openMaterial(materialId) {
  const { url, error } = await materialUrl(materialId);
  if (error) return { error };

  await WebBrowser.openBrowserAsync(url);
  return { error: null };
}

/**
 * Retries every attachment that never made it.
 *
 * Called after a sync, so a file picked on a dead connection lands as soon as
 * there is one rather than waiting for the student to notice and try again.
 */
export async function retryFailedUploads() {
  const pending = useStudyStore
    .getState()
    .materials.filter(
      (material) =>
        // `pending` is deliberately not retried: it means the bytes arrived
        // and the server has yet to read them, which is its job, not ours.
        material.uri &&
        (material.uploadStatus === "failed" || material.uploadStatus === "queued"),
    );

  for (const material of pending) {
    await uploadMaterial(material);
  }
}
