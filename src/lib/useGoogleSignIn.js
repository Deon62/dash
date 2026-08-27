import { useEffect, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";

import { GOOGLE_CLIENT_IDS, googleConfigured, signInWithGoogle } from "@/lib/auth";

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
const Google = googleConfigured
  ? // eslint-disable-next-line global-require
    require("expo-auth-session/providers/google")
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
 * Google sign-in, ending in a session.
 *
 * A hook rather than a function because the consent screen is a round trip
 * through the browser: the request has to be prepared while the screen renders,
 * and the answer arrives later as a response object rather than as the return
 * value of the call that started it.
 *
 * `useIdTokenAuthRequest` rather than the plain auth request: the server wants
 * an ID token, not an access token, and this is what makes Google issue one.
 */
export function useGoogleSignIn({ onSignedIn } = {}) {
  // Conditional, and safe: `Google` is decided once when this module is first
  // loaded and never changes, so the number of hooks called is constant for
  // the life of the process — which is the rule that actually matters.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [request, response, promptAsync] = Google
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      Google.useIdTokenAuthRequest({
        clientId: GOOGLE_CLIENT_IDS.webClientId,
        iosClientId: GOOGLE_CLIENT_IDS.iosClientId,
        androidClientId: GOOGLE_CLIENT_IDS.androidClientId,
      })
    : [null, null, null];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [error, setError] = useState("");

  // The callback changes identity every render; a ref keeps the effect below
  // keyed on the response alone, so it runs once per sign-in rather than on
  // every re-render of the screen that mounted this.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const done = useRef(onSignedIn);
  done.current = onSignedIn;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!response) return undefined;

    if (response.type === "dismiss" || response.type === "cancel") {
      setBusy(false);
      return undefined;
    }

    if (response.type === "error") {
      setBusy(false);
      setError("Google sign-in did not complete. Try again.");
      return undefined;
    }

    if (response.type !== "success") return undefined;

    const idToken =
      response.params?.id_token ?? response.authentication?.idToken ?? null;

    let cancelled = false;

    (async () => {
      const result = await signInWithGoogle(idToken);
      if (cancelled) return;

      setBusy(false);
      if (result.error) setError(result.error);
      else done.current?.(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [response]);

  if (!Google) return UNAVAILABLE;

  return {
    /** False until the request is prepared, so the button cannot be pressed early. */
    available: Boolean(request),
    busy,
    error,
    clearError: () => setError(""),
    start: async () => {
      if (!request) return;
      setBusy(true);
      setError("");
      await promptAsync();
    },
  };
}
