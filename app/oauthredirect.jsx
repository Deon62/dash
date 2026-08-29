import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { PageLoader } from "@/components/Loader";
import { googleAuth } from "@/lib/useGoogleSignIn";

/**
 * Where Google's redirect lands.
 *
 * This screen exists because of how the redirect actually arrives on Android.
 * Google sends the browser to `com.ardena.als:/oauthredirect?code=…`, the OS
 * hands that URL to the app, and *two* things react to it: `expo-web-browser`,
 * which opened the consent tab and is waiting for exactly this, and Expo
 * Router, for which any incoming link is a navigation to the route the path
 * names. There was no such route, so the router showed "Unmatched Route" —
 * over a sign-in that had, underneath it, just succeeded.
 *
 * Adding the file is what stops the 404. It does not stop the navigation, and
 * it should not: the navigation is why the sign-in has to be able to finish
 * from outside the login screen, which is what `src/lib/googleAuth.js` is for.
 * This screen only forwards the params to it and waits.
 *
 * There is nothing to read here, so there is nothing written here — a page of
 * explanation would be on screen for a few hundred milliseconds and would make
 * a working sign-in feel like a step the student had to complete.
 *
 * Listed in `AUTH_ROUTES` in `useSessionGuard`, so the guard leaves it alone
 * while the exchange runs and then routes off the new session in the ordinary
 * way — to intake for a new student, to the tabs for a returning one.
 */
export default function OAuthRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // A build too old to have `expo-auth-session` cannot have started a
      // sign-in either, so there is nothing here to finish.
      if (!googleAuth) {
        router.replace("/login");
        return;
      }

      const { done } = await googleAuth.completeRedirect({
        code: params.code,
        state: params.state,
        error: params.error,
      });

      if (cancelled) return;

      // On success the guard moves us, because the session it watches has
      // changed. It cannot move us off a failure — nothing changed — and it
      // cannot move us off a duplicate, where the browser got there first and
      // this navigation is the leftover. Both belong back at sign-in, where
      // any error is already on screen: the login page reads the same
      // `googleAuth` state this does.
      if (!done || googleAuth.getState().error) router.replace("/login");
    })();

    return () => {
      cancelled = true;
    };
    // Params are the redirect; it does not change while this is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <PageLoader label="Finishing sign-in…" />;
}
