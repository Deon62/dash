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
 * The bytes go up as `multipart/form-data` holding a `{ uri, name, type }`
 * descriptor. That is deliberate and it is the only shape that works here:
 * React Native's networking layer streams the file off disk itself when it
 * sees one, so a 50MB PDF never passes through JavaScript — and, unlike every
 * other approach, it needs no filesystem module at all. Supabase Storage takes
 * the first file part whatever it is named, which is why the field name is the
 * empty string that its own client library uses.
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

  // Measured by the picker when the file was chosen, not read back off disk.
  // The server needs a real number — it checks the plan's file-size limit
  // before signing anything — and a zero would be refused as malformed.
  const byteSize = material.byteSize ?? 0;
  if (!byteSize) {
    return fail("That file's size could not be read, so it was not uploaded.");
  }

  const mimeType = material.mimeType ?? MIME[material.kind] ?? "application/octet-stream";
  const filename = material.filename ?? material.title;

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

  updateMaterial(material.id, { uploadStatus: "uploading" });

  const body = new FormData();
  // Supabase's own client sends the file under an empty field name, and the
  // storage service takes the first file part regardless of what it is called.
  body.append("", { uri: material.uri, name: filename, type: mimeType });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(signed.data.upload_url, {
      method: "PUT",
      signal: controller.signal,
      // No Content-Type header: it has to carry the multipart boundary, and
      // only whoever serialises the body knows what that is. Setting it by
      // hand here produces a boundary that does not match the body and an
      // upload the server cannot parse.
      body,
    });

    if (!response.ok) {
      return fail(`The upload did not complete (${response.status}).`);
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
 * Opens the stored file.
 *
 * The link is minted per request and expires, because the buckets are private
 * — which is the whole reason not to serve coursework from a public one. The
 * system browser rather than an in-app view, so a PDF opens in whatever the
 * student already reads PDFs in.
 */
export async function openMaterial(materialId) {
  const { data, error } = await authed((token) =>
    materialsApi.downloadUrl(materialId, token),
  );

  if (error) return { error };

  await WebBrowser.openBrowserAsync(data.url);
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
