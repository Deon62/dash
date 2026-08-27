import { account } from "@/api/endpoints";
import { useStudyStore } from "@/store/useStudyStore";
import { DEVICE, deviceId } from "@/lib/session";
import { loadProfile } from "@/lib/account";

/**
 * Signing in, against the real API.
 *
 * Two ways in: a code texted to a number, and Google. Both end at the same
 * place — a token pair from the server, written into the store by
 * `setSession`, after which every other call in the app can authenticate.
 *
 * Everything resolves to `{ error }` and never throws, because these are
 * called straight from button handlers.
 */

const CODE_LENGTH = 6;

/**
 * Google's OAuth client ids, from the build's environment.
 *
 * Absent means the button is not shown at all — see `googleConfigured`. A
 * consent screen that cannot complete is worse than an option that was never
 * offered, and it is also what the server does: with no `GOOGLE_CLIENT_IDS`
 * configured, `/auth/google` refuses every token it is handed.
 */
export const GOOGLE_CLIENT_IDS = {
  // The web client id is the audience the server checks, so it is required
  // even on a phone: the native clients are issued tokens *for* it.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
};

export const googleConfigured = Boolean(GOOGLE_CLIENT_IDS.webClientId);

/** Texts a code. `phone` is full E.164, e.g. +254712345678. */
export async function sendPhoneOtp(phone) {
  if (!phone) return { error: "Enter a mobile number first." };

  const { error } = await account.requestOtp(phone);
  return error ? { error } : {};
}

/**
 * Exchanges the code for a session.
 *
 * The length check stays in front of the request: an empty or half-typed code
 * is a mistake either way, and there is no reason to spend a round trip and a
 * rate-limit slot proving it.
 *
 * Signing in takes the account over — the server ends any other live session —
 * so the device id sent here is what makes remote sign-out work later. Without
 * it a token is never invalidated, which is exactly the hole a paid account
 * gets shared through.
 */
export async function verifyPhoneOtp(phone, code) {
  if (!/^\d{6}$/.test(String(code ?? ""))) {
    return { error: `Enter the ${CODE_LENGTH}-digit code.` };
  }

  const { data, error } = await account.verifyOtp(phone, code, {
    deviceId: deviceId(),
    platform: DEVICE.platform,
    appVersion: DEVICE.appVersion,
  });

  if (error) return { error };

  return openSession(data);
}

/**
 * Trades a Google ID token for a session.
 *
 * The token comes from the device's own Google sign-in — see
 * `useGoogleSignIn` in `src/lib/useGoogleSignIn.js`. Nothing is trusted from
 * it here: the server verifies the audience, the issuer and that the address
 * is confirmed before it will issue anything.
 */
export async function signInWithGoogle(idToken) {
  if (!idToken) return { error: "Google did not return a sign-in." };

  const { data, error } = await account.signInWithGoogle(idToken, {
    deviceId: deviceId(),
    platform: DEVICE.platform,
    appVersion: DEVICE.appVersion,
  });

  if (error) return { error };

  return openSession(data);
}

/**
 * Turns a token pair into a live session.
 *
 * The tokens are written first and the session is only declared open once the
 * account has been read back. That order is what stops a returning student
 * seeing intake flash past on a new phone: the route guard reacts the instant
 * `isAuthenticated` flips, and until the profile has landed it has no way to
 * know they finished intake a semester ago.
 */
async function openSession(data) {
  const store = useStudyStore.getState();

  store.setTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });

  // A brand-new account has nothing to read — the profile is empty by
  // definition, and intake is where it gets filled in.
  if (!data.is_new_user) await loadProfile();

  store.setSession({
    userId: data.user_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });

  return { isNewUser: Boolean(data.is_new_user) };
}
