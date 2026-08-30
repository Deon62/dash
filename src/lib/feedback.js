import { account } from "@/api/endpoints";
import { DEVICE, authed } from "@/lib/session";

/**
 * A feature request, on its way to us.
 *
 * Deliberately not part of `src/lib/sync.js`. Everything in the sync engine is
 * the student's own content, replicated to a device that has to work with no
 * server; this is a message to us and has no reason to exist on the phone once
 * it is sent. A queued submission that fires three days later, out of the
 * context that prompted it, is worse than one that was never sent — so a
 * failure is reported and the text is left in the box to retry.
 *
 * Write-only. There is no read side and no local copy: see `account.featureRequest`.
 */

/** Below this the server refuses, so the Send button stays disabled until it. */
export const MIN_LENGTH = 10;

/** The server's ceiling. Enforced on the input so the 422 is unreachable. */
export const MAX_LENGTH = 2000;

/** Where the counter starts appearing. Late enough to warn rather than nag. */
export const COUNTER_FROM = 1800;

/**
 * The confirmation if the server sends none.
 *
 * `message` on a 201 is the server's to word, so it can be changed without a
 * release. This only covers a success that arrived with an empty body — saying
 * nothing after a successful send would read as the send having failed.
 */
const SENT = "Thanks — your idea is with the team.";

/**
 * Sends one. Resolves to `{ message, error }` and never throws.
 *
 * A 401 needs nothing here: `authed` refreshes and retries once, and a refusal
 * on the retry signs the session out, which `useSessionGuard` turns into a
 * redirect to sign-in. The message is shown either way.
 */
export async function sendFeatureRequest(text) {
  const body = String(text ?? "").trim();

  const { data, error } = await authed((token) =>
    account.featureRequest(
      { body, appVersion: DEVICE.appVersion, platform: DEVICE.platform },
      token,
    ),
  );

  if (error) return { message: null, error };

  return { message: data?.message || SENT, error: null };
}
