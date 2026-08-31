import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";

import { account } from "@/api/endpoints";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * The session: the access token, and everything that keeps one alive.
 *
 * Every authenticated call in the app goes through `authed()`. That is the
 * whole reason this file exists — a token read straight out of the store at a
 * call site is a token nobody refreshes, and the failure mode is a student
 * being signed out mid-lecture half an hour after they signed in.
 *
 * Nothing here throws. Callers are button handlers.
 */

export const NOT_SIGNED_IN =
  "You are signed out. Sign in again to reach your account.";

/**
 * What the server records this handset as.
 *
 * `nativeApplicationVersion` first, and that ordering matters now that the
 * server can force a build off the network. Two things read this number and
 * they have to mean the same thing by it: the adoption report — the count of
 * students a raised floor locks out, which is built from these device rows —
 * and the release check, which asks which *binary* is running. An OTA update
 * carries its own config, so the config's version is what was published rather
 * than what was installed; measuring the floor against one and reporting the
 * other is how a forced update turns into an outage nobody sized.
 *
 * The config version stays as the fallback for web and for Expo Go, where
 * there is no installed binary to name.
 */
export const DEVICE = {
  platform: Platform.OS,
  appVersion:
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    Constants.manifest2?.extra?.expoClient?.version ??
    "",
};

/**
 * One refresh at a time, shared by everyone waiting on it.
 *
 * Without this, five screens hitting a stale token on launch fire five
 * refreshes; the server rotates on each, and four of them end up holding a
 * token that has already been revoked — which looks exactly like being signed
 * out at random.
 */
let inFlight = null;

/** The device id, minted on first use and kept for the life of the install. */
export function deviceId() {
  return useStudyStore.getState().ensureDeviceId();
}

/**
 * Swaps the refresh token for a new pair.
 *
 * Returns the new access token, or null if the refresh token is spent — in
 * which case the session is over and the store is cleared, because leaving a
 * signed-in shell with no working credential means every screen fails one at a
 * time instead of once.
 */
export async function refreshSession() {
  if (inFlight) return inFlight;

  const { refreshToken } = useStudyStore.getState();

  // No refresh token and an access token that needs replacing is a session
  // that cannot be recovered. Ending it here is what stops the app sitting in
  // a signed-in shell where every screen fails one at a time.
  if (!refreshToken) {
    useStudyStore.getState().signOut();
    return null;
  }

  inFlight = (async () => {
    const { data, error, status } = await account.refresh(refreshToken);

    if (error) {
      // A network failure is not a dead session. Only the server saying no —
      // 401 for a revoked token, 400 for a malformed one — ends it.
      if (status === 401 || status === 403 || status === 400) {
        useStudyStore.getState().signOut();
      }
      return null;
    }

    useStudyStore.getState().setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });

    return data.access_token;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * A usable access token, refreshed first if it is about to expire.
 *
 * Refreshing on the clock rather than only on a 401 is what keeps the common
 * case to one round trip: the store stamps `tokenExpiresAt` a minute early, so
 * a token that would expire mid-request is replaced before it is sent.
 */
export async function accessToken() {
  const { authToken, tokenExpiresAt } = useStudyStore.getState();
  if (!authToken) return null;

  if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
    return (await refreshSession()) ?? null;
  }

  return authToken;
}

/**
 * Runs one authenticated call, with a single retry behind a refresh.
 *
 * `call` takes a token and returns the usual `{ data, error, status }`. The
 * retry exists for the case the clock cannot catch: a token revoked early
 * because the account signed in on another handset, or a server restart that
 * invalidated it.
 */
export async function authed(call) {
  const token = await accessToken();
  if (!token) return { data: null, error: NOT_SIGNED_IN, status: 401 };

  const first = await call(token);
  if (first.status !== 401) return first;

  const fresh = await refreshSession();
  if (!fresh) return { data: null, error: NOT_SIGNED_IN, status: 401 };

  return call(fresh);
}

/**
 * Tells the server this handset exists, and hands it a push token when there
 * is one. Idempotent — it is a PUT on an id the device minted.
 */
export async function registerDevice(pushToken = null) {
  return authed((token) =>
    account.registerDevice(
      {
        id: deviceId(),
        platform: DEVICE.platform,
        app_version: DEVICE.appVersion,
        push_token: pushToken,
      },
      token,
    ),
  );
}

/**
 * Ends the session on the server as well as here.
 *
 * The local clear happens whatever the server says. A student tapping "log
 * out" on a train has to end up logged out; a revocation that could not be
 * delivered is the server's problem, and the access token expires on its own
 * within the half hour either way.
 */
export async function endSession() {
  const { refreshToken } = useStudyStore.getState();

  if (refreshToken) {
    await authed((token) => account.signOut(deviceId(), token));
  }

  useStudyStore.getState().signOut();
}
