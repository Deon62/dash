import { useStudyStore } from "@/store/useStudyStore";
import { uploadMaterial, openMaterial, materialUrl } from "@/lib/materials";
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
