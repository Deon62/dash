import { account as accountApi } from "@/api/endpoints";
import { OFFLINE } from "@/api/client";
import { authed } from "@/lib/session";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * Getting the profile photo off the phone and onto the account.
 *
 * The same three steps as a material — sign, PUT straight at Supabase Storage,
 * confirm — and for the same reason: the bytes never pass through the API.
 *
 * This existed as one line before: the picker's local `file://` URI was written
 * into the store and nothing else happened. It looked right, because the store
 * is persisted and the file is genuinely on the phone. Then signing out cleared
 * the store, the next sign-in read the profile back from a server that had
 * never been told anything, and the picture was gone. The `avatars` bucket was
 * empty while `materials` filled up, which is what gave it away.
 *
 * Two values are kept, and the difference matters:
 *
 * * `avatarPath` is the object in the bucket. Durable, and the thing the server
 *   stores.
 * * `avatarUri` is what an `<Image>` can actually load — a signed URL that
 *   expires, or the local file while the upload is still in flight.
 *
 * Persisting the second without the first is the trap: a stored URL is a link
 * that quietly stops working, and the photo would disappear again, just more
 * slowly.
 */

/** Bounded. A stalled upload must not leave the picker spinning for good. */
const UPLOAD_TIMEOUT_MS = 60000;

/** What the picker hands back, mapped to what the bucket accepts. */
const MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * The content type to declare for a picked image.
 *
 * `expo-image-picker` reports `mimeType` on some platforms and not others, so
 * the extension is the fallback. JPEG last of all: the picker is configured to
 * edit and compress, which produces a JPEG, and declaring the wrong type is
 * what makes Storage refuse an upload the server already signed.
 */
function mimeFor(asset) {
  if (asset?.mimeType && asset.mimeType.startsWith("image/")) return asset.mimeType;

  const extension = asset?.uri?.split("?")[0].split(".").pop()?.toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "image/jpeg";
}

/**
 * Reads the picked image into memory and measures it.
 *
 * The size has to be real: the server checks it against the bucket ceiling
 * before it signs anything, and `expo-image-picker` leaves `fileSize`
 * undefined often enough on Android that trusting it means refusing photos
 * that were always fine.
 */
async function readFile(uri) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    if (!blob?.size) {
      return { blob: null, error: "That photo could not be read." };
    }

    return { blob, error: null };
  } catch {
    return { blob: null, error: "That photo is no longer on this phone." };
  }
}

/**
 * Uploads a picked image and makes it this student's profile photo.
 *
 * Resolves to `{ error }`. The local URI is shown immediately and put back to
 * whatever it was if the upload fails — a photo that appears and then silently
 * is not saved is the bug this replaces, so a failure has to be visible.
 */
export async function uploadAvatar(asset) {
  const store = useStudyStore.getState();
  const previous = {
    avatarUri: store.profile.avatarUri,
    avatarPath: store.profile.avatarPath,
  };

  const revert = (error) => {
    useStudyStore.getState().setAvatar(previous);
    return { error };
  };

  const mimeType = mimeFor(asset);

  // Optimistic, and honest: this is the file the student just chose, so it is
  // the right thing to show while it travels.
  store.setAvatar({ avatarUri: asset.uri, avatarPath: previous.avatarPath });

  const { blob, error: unreadable } = await readFile(asset.uri);
  if (unreadable) return revert(unreadable);

  const signed = await authed((token) =>
    accountApi.avatarUploadUrl({ mimeType, byteSize: blob.size }, token),
  );

  // Type and size are refused here, before a byte moves.
  if (signed.error) return revert(signed.error);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(signed.data.upload_url, {
      method: "PUT",
      signal: controller.signal,
      headers: { "Content-Type": mimeType },
      body: blob,
    });

    if (!response.ok) {
      return revert(`That photo could not be stored (${response.status}).`);
    }
  } catch (error) {
    return revert(
      error?.name === "AbortError"
        ? "That upload took too long and was stopped."
        : OFFLINE,
    );
  } finally {
    clearTimeout(timer);
  }

  const confirmed = await authed((token) =>
    accountApi.confirmAvatar(signed.data.path, token),
  );

  // The object is in the bucket but the account does not point at it. Reverting
  // is right: what the student sees now matches what they will see after the
  // next sign-in, which is the only thing that was ever wrong here.
  if (confirmed.error) return revert(confirmed.error);

  useStudyStore.getState().setAvatar({
    avatarUri: asset.uri,
    avatarPath: confirmed.data?.avatar_path ?? signed.data.path,
  });

  // The local file is fine to display now, but it is a cache entry the OS may
  // clear. Swapping in the signed URL means the next launch has something that
  // works even if it has gone.
  await refreshAvatarUrl();

  return { error: null };
}

/**
 * Replaces the displayed photo with a freshly signed URL.
 *
 * Called after the profile loads and after an upload. Silent on failure: an
 * expired or unreachable photo is not worth an error in front of somebody who
 * did not ask for one, and the initials behind it are a reasonable fallback.
 */
export async function refreshAvatarUrl() {
  const { profile } = useStudyStore.getState();
  if (!profile.avatarPath) return { error: null };

  const { data, error } = await authed((token) => accountApi.avatarUrl(token));
  if (error) return { error };

  useStudyStore.getState().setAvatar({
    avatarUri: data.url,
    avatarPath: profile.avatarPath,
  });

  return { error: null };
}

/** Clears the photo, on the account and on the phone. */
export async function removeAvatar() {
  const { error } = await authed((token) => accountApi.removeAvatar(token));
  if (error) return { error };

  useStudyStore.getState().setAvatar({ avatarUri: null, avatarPath: null });
  return { error: null };
}
