import { useStudyStore } from "@/store/useStudyStore";
import { uploadMaterial, openMaterial, materialUrl } from "@/lib/materials";
import { captureScan, pickScan } from "@/lib/scan";
import { sync } from "@/lib/sync";

/**
 * Filing something under a unit, and getting it onto the account.
 *
 * Two screens add knowledge — the Knowledge tab and a unit's own page — and
 * both need the same three steps in the same order: write it locally so it
 * appears at once, carry the bytes up if there are any, then push the row.
 * A second copy of that sequence is a second chance to forget the upload and
 * leave the tutor quietly unable to read what a student can plainly see.
 */

/**
 * Files one item. Resolves to `{ material, error }`.
 *
 * The row is written before anything is sent, so the sheet closes on a
 * finished action rather than on a spinner. `error` is only ever about the
 * file: a note is filed the moment it is typed, and its row goes up with the
 * next sync whether or not there is a connection right now.
 */
export async function fileMaterial({
  unitId,
  title,
  body = "",
  kind = "note",
  uri = null,
  filename,
  mimeType,
}) {
  const material = useStudyStore.getState().addMaterial({
    unitId,
    title,
    body,
    kind,
    uri,
  });

  // Carried on the row rather than passed around: a retry after a failed
  // upload happens long after this call returned, and it needs them too. The
  // size is deliberately not among them — it is measured from the file itself
  // at upload time, because the picker's own figure is often missing.
  if (uri) {
    useStudyStore.getState().updateMaterial(material.id, { filename, mimeType });
  }

  const upload = uri
    ? await uploadMaterial({ ...material, filename, mimeType })
    : { error: null };

  // Unawaited: the item is on screen and the student is done with this sheet.
  sync();

  return { material, error: upload.error };
}

export { openMaterial, materialUrl };

/**
 * Replaces the photo behind a scan that came back unreadable.
 *
 * A new photo against the **same material id**, deliberately. The id is the
 * object path in the bucket and the row the server upserts on, so this
 * overwrites rather than filing a second copy — the alternative leaves a
 * student with two rows, one of them permanently broken, and a list that grows
 * a dead entry every time they try again.
 *
 * It exists because "retry" is the wrong offer for this state. The server has
 * already read these bytes and reached a verdict; sending them again can only
 * produce the same verdict. The page shot straight, or in better light, is the
 * only thing that changes the answer.
 *
 * Resolves to `{ error }` — null when the student simply backed out.
 */
export async function rescanMaterial(material, { take = true } = {}) {
  const { payload, error } = take
    ? await captureScan(material.title)
    : await pickScan(material.title);

  if (error) return { error };
  if (!payload) return { error: null };

  // The title is the student's, not the file's. They named this when they
  // filed it, and a retake is the same page — replacing the name with
  // "scan.jpg" would quietly undo that.
  useStudyStore.getState().updateMaterial(material.id, {
    uri: payload.uri,
    filename: payload.filename,
    mimeType: payload.mimeType,
    uploadStatus: "queued",
    // The old verdict is about bytes that are being replaced. Left in place it
    // would sit under the new upload's progress bar, explaining a failure that
    // is no longer the one happening.
    extractionError: null,
    pageCount: null,
  });

  const material_ = useStudyStore
    .getState()
    .materials.find((row) => row.id === material.id);

  const upload = await uploadMaterial(material_);

  sync();

  return { error: upload.error };
}
