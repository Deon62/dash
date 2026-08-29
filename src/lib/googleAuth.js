import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { GOOGLE_CLIENT_IDS, googleConfigured, signInWithGoogle } from "@/lib/auth";

/**
 * Google sign-in, held outside the React tree.
 *
 * This used to be `useIdTokenAuthRequest` inside a hook, and the round trip
 * through the browser is exactly the thing a hook cannot survive.
 *
 * When Google redirects to `com.ardena.als:/oauthredirect?code=...`, Android
 * hands that URL to the app — and *two* things are listening for it.
 * `expo-web-browser` wants it, to resolve the auth session it opened. Expo
 * Router also wants it, because an incoming link is a navigation, and it will
 * go to whatever route the path names. There was no `oauthredirect` route, so
 * the router rendered "Unmatched Route" over the top of a sign-in that had
 * just succeeded — and that navigation unmounted the login screen, taking the
 * hook, its `codeVerifier` and the pending exchange down with it.
 *
 * So the request lives here instead, at module scope, and its PKCE verifier is
 * written to disk as well. Nothing about finishing a sign-in depends on which
 * screen is mounted, or on the process having stayed alive: whichever arrives
 * first — the browser result or the deep link — completes it, and the other is
 * ignored. `app/oauthredirect.jsx` is the route that catches the navigation
 * and calls in here.
 */

/**
 * Google's endpoints, written out rather than discovered.
 *
 * `fetchDiscoveryAsync` is a network round trip before the browser can even
 * open, and it fails in exactly the places sign-in is already hardest — a slow
 * connection, a captive portal. These three URLs have been stable for years
 * and are the same ones `expo-auth-session`'s own Google provider ships.
 */
const DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/**
 * Where Google sends the browser back to.
 *
 * `<applicationId>:/oauthredirect` — the reverse-DNS package scheme — is the
 * only redirect shape Google accepts for a native client, and it is why
 * `com.ardena.als` has to be in `scheme` in app.json: without an intent filter
 * for it Android has nothing to hand the redirect to.
 *
 * Pinned rather than left to `makeRedirectUri`, which only returns the native
 * form once `Constants.executionEnvironment` says standalone or bare, and
 * otherwise falls back to the app's *first* declared scheme — `als://`, which
 * the Google console has never been told about. That difference is invisible
 * until it fails, so it is not worth inferring.
 */
export const REDIRECT_URI = `${Application.applicationId}:/oauthredirect`;

/** The path half of the above, which is what Expo Router routes on. */
export const REDIRECT_PATH = "oauthredirect";

const CLIENT_ID =
  Platform.select({
    android: GOOGLE_CLIENT_IDS.androidClientId,
    ios: GOOGLE_CLIENT_IDS.iosClientId,
    default: GOOGLE_CLIENT_IDS.webClientId,
  }) ?? GOOGLE_CLIENT_IDS.webClientId;

const SCOPES = ["openid", "profile", "email"];

/**
 * Survives the process being killed while the consent screen is open, which
 * Android will do freely to a backgrounded app on a cheap phone. Without it a
 * cold start on the redirect has a code it can never exchange, because the
 * verifier that proves the code is ours only ever existed in memory.
 */
const PENDING_KEY = "als.google.pending";

/** Nothing older than this is worth finishing; Google's codes die sooner. */
const PENDING_TTL_MS = 10 * 60 * 1000;

// --- What the screens watch ------------------------------------------------

let state = { busy: false, error: "" };
const listeners = new Set();

function publish(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

/** Subscribes to `{ busy, error }`. Returns the unsubscribe. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function clearError() {
  if (state.error) publish({ error: "" });
}

/** Called with the session once a sign-in lands, whichever path finished it. */
let onSignedIn = null;
export function setSignedInHandler(handler) {
  onSignedIn = handler;
}

// --- The pending request ---------------------------------------------------

/**
 * The live request, when there is one.
 *
 * Two copies on purpose: the in-memory one is preferred because it is
 * certainly the current attempt, and the stored one is the two fields needed
 * to finish after the process has been restarted underneath us.
 */
let pending = null;

async function rememberPending(request) {
  pending = {
    state: request.state,
    codeVerifier: request.codeVerifier,
  };

  try {
    await AsyncStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ ...pending, at: Date.now() }),
    );
  } catch {
    // Disk full, or storage unavailable. The in-memory copy still covers the
    // ordinary case; only a cold start mid-consent is lost, and that ends in
    // "try again" rather than in anything worse.
  }
}

async function readPending() {
  if (pending) return pending;

  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw);
    if (!stored?.codeVerifier) return null;
    if (Date.now() - (stored.at ?? 0) > PENDING_TTL_MS) return null;

    return { state: stored.state, codeVerifier: stored.codeVerifier };
  } catch {
    return null;
  }
}

async function forgetPending() {
  pending = null;
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing depends on the removal: the TTL and the one-shot guard below
    // both stop a stale entry being used twice.
  }
}

/**
 * Codes already spent, by `state`.
 *
 * The browser result and the deep link are the *same* redirect arriving twice.
 * Exchanging a code a second time fails at Google — correctly, a code is
 * single-use — and that failure would land on the student as an error under a
 * sign-in that actually worked. So the second arrival is dropped here instead.
 */
const settled = new Set();

/** The exchange in flight, so two arrivals await one result rather than race. */
let exchange = null;

// --- Starting ---------------------------------------------------------------

/**
 * Opens the consent screen. Resolves when the flow ends, either way.
 *
 * The session is deliberately not returned: it is announced through
 * `setSignedInHandler` and the store, because on the deep-link path whoever
 * called this may no longer be mounted to receive anything.
 */
export async function start() {
  if (!available) return;
  if (state.busy) return;

  publish({ busy: true, error: "" });

  try {
    const request = new AuthSession.AuthRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      // Without this a phone with one Google account signed in never shows the
      // chooser, so a student cannot pick which account the app uses.
      extraParams: { prompt: "select_account" },
    });

    await request.makeAuthUrlAsync(DISCOVERY);
    await rememberPending(request);

    const result = await request.promptAsync(DISCOVERY);

    if (result.type === "success") {
      await completeRedirect(result.params);
      return;
    }

    if (result.type === "error") {
      await forgetPending();
      publish({
        busy: false,
        error: "Google sign-in did not complete. Try again.",
      });
      return;
    }

    // `dismiss` and `cancel` are usually someone changing their mind — but not
    // always. On Android the router can win the race for the redirect, in
    // which case this returns `dismiss` while `completeRedirect` is already
    // running from the route. Leaving `busy` up lets that finish and report.
    if (result.type === "dismiss" || result.type === "cancel") {
      if (!exchange) {
        await forgetPending();
        publish({ busy: false });
      }
    }
  } catch {
    await forgetPending();
    publish({ busy: false, error: "Google sign-in could not be opened." });
  }
}

// --- Finishing --------------------------------------------------------------

/**
 * Turns the redirect's params into a session.
 *
 * Safe to call twice with the same redirect, and safe to call with one from an
 * attempt that has already been abandoned — both are ordinary on Android,
 * where the browser and the router both see the incoming URL.
 *
 * @param params `{ code, state, error }` from the redirect URL.
 * @returns `{ done }` — `done` false means this was a duplicate or a stale
 *   redirect, and the caller should simply get out of the way.
 */
export async function completeRedirect(params = {}) {
  const { code, state: returnedState, error: googleError } = params;

  if (googleError) {
    await forgetPending();
    publish({ busy: false, error: "Google sign-in did not complete. Try again." });
    return { done: true };
  }

  if (!code) return { done: false };

  // Already spent by the other listener. Not an error, and not ours to report.
  if (returnedState && settled.has(returnedState)) return { done: false };

  // A second arrival while the first is still exchanging: wait on it rather
  // than start a competing one.
  if (exchange) {
    await exchange;
    return { done: false };
  }

  const stored = await readPending();

  if (!stored) {
    publish({
      busy: false,
      error: "That sign-in took too long to come back. Try again.",
    });
    return { done: true };
  }

  /**
   * `state` is what ties this redirect to the request we made. A mismatch is
   * either a leftover from an abandoned attempt or someone feeding the app a
   * link — neither should be exchanged.
   */
  if (returnedState && stored.state && returnedState !== stored.state) {
    return { done: false };
  }

  if (returnedState) settled.add(returnedState);
  publish({ busy: true, error: "" });

  exchange = (async () => {
    try {
      const tokens = await AuthSession.exchangeCodeAsync(
        {
          clientId: CLIENT_ID,
          redirectUri: REDIRECT_URI,
          code,
          extraParams: { code_verifier: stored.codeVerifier },
        },
        DISCOVERY,
      );

      // The server wants an ID token, not an access token: it verifies the
      // audience, the issuer and that the address is confirmed, none of which
      // an access token carries.
      const idToken = tokens?.idToken ?? null;
      if (!idToken) {
        publish({ busy: false, error: "Google did not return a sign-in." });
        return { done: true };
      }

      const result = await signInWithGoogle(idToken);

      if (result.error) {
        publish({ busy: false, error: result.error });
        return { done: true };
      }

      publish({ busy: false, error: "" });
      onSignedIn?.(result);
      return { done: true };
    } catch {
      publish({
        busy: false,
        error: "Google sign-in could not be completed. Try again.",
      });
      return { done: true };
    } finally {
      await forgetPending();
      // Closes the consent tab still sitting over the app when the router,
      // rather than the browser, was the one that caught the redirect.
      try {
        WebBrowser.dismissAuthSession();
      } catch {
        // Not implemented on every platform, and never worth failing over.
      }
    }
  })();

  const outcome = await exchange;
  exchange = null;
  return outcome;
}

/** True where the button should be offered at all. See `googleConfigured`. */
export const available = googleConfigured && Boolean(CLIENT_ID);
