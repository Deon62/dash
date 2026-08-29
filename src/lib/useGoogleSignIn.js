import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";

import { googleConfigured } from "@/lib/auth";

/**
 * Loaded only where it can be used.
 *
 * `expo-auth-session` pulls in `expo-application`, which is a native module —
 * so a build that predates it would crash on import. A build with no client
 * ids cannot offer Google sign-in anyway, so requiring the module only when
 * there are ids means those builds never touch it.
 *
 * `require` rather than `import` because the decision has to be made at
 * runtime; the value is a module-level constant, so the hook count below never
 * changes between renders.
 */
export const googleAuth = googleConfigured
  ? // eslint-disable-next-line global-require
    require("@/lib/googleAuth")
  : null;

// Closes the browser tab the consent screen opened once it redirects back.
// Without it the tab stays over the app on Android after a successful sign-in.
WebBrowser.maybeCompleteAuthSession();

/** What the hook returns where Google is not on offer. Never changes shape. */
const UNAVAILABLE = {
  available: false,
  busy: false,
  error: "",
  clearError: () => {},
  start: async () => {},
};

/**
 * Google sign-in, as a screen sees it.
 *
 * Thin on purpose. The flow itself lives in `src/lib/googleAuth.js`, at module
 * scope, because it outlives this hook: the redirect from Google arrives as a
 * deep link, Expo Router treats a deep link as a navigation, and that
 * navigation unmounts whichever screen started the sign-in. Anything held in
 * component state at that moment — the PKCE verifier above all — is gone
 * before the code can be exchanged. So this only subscribes to progress and
 * forwards the button press.
 *
 * `onSignedIn` is optional and rarely wanted: the session lands in the store,
 * and `useSessionGuard` routes off it. A screen that passes one is asking for
 * something extra, not for navigation.
 */
export function useGoogleSignIn({ onSignedIn } = {}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [state, setState] = useState(() =>
    googleAuth ? googleAuth.getState() : { busy: false, error: "" },
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!googleAuth) return undefined;

    // Read once on mount as well as subscribing: a sign-in can complete while
    // this screen is unmounted — that is the whole reason the flow moved out
    // of here — and remounting must not show stale idle state under it.
    setState(googleAuth.getState());
    return googleAuth.subscribe(setState);
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!googleAuth || !onSignedIn) return undefined;

    googleAuth.setSignedInHandler(onSignedIn);
    return () => googleAuth.setSignedInHandler(null);
  }, [onSignedIn]);

  if (!googleAuth) return UNAVAILABLE;

  return {
    available: googleAuth.available,
    busy: state.busy,
    error: state.error,
    clearError: googleAuth.clearError,
    start: googleAuth.start,
  };
}
