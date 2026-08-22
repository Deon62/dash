import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";

import { useStudyStore } from "@/store/useStudyStore";

/** Routes reachable without a session. */
const AUTH_ROUTES = new Set(["login", "verify"]);

/**
 * Keeps the student on a screen they are allowed to be on.
 *
 * Four states, in order: a first-ever launch goes to /intro, signed out goes to
 * /login, signed in but not through intake goes to /onboarding, and anyone past
 * all three belongs in the tabs. Mounted once from the root layout, below the
 * navigator — redirecting before there is anything to redirect within silently
 * does nothing.
 */
export function useSessionGuard() {
  const router = useRouter();
  const segments = useSegments();

  const hydrated = useStudyStore((state) => state.hydrated);
  const introSeen = useStudyStore((state) => state.introSeen);
  const isAuthenticated = useStudyStore((state) => state.isAuthenticated);
  const onboarded = useStudyStore((state) => state.onboarded);

  useEffect(() => {
    // Waiting on hydration matters: redirecting before the stored session has
    // been read back would bounce a signed-in student out to /login on every
    // cold start, which looks exactly like being logged out at random.
    if (!hydrated) return;

    const root = segments[0];
    const onAuthScreen = AUTH_ROUTES.has(root);
    const onOnboarding = root === "onboarding";
    const onIntro = root === "intro";

    // The explainer comes before everything, including the sign-in wall: it is
    // what tells a first-time visitor why they would want an account at all.
    if (!introSeen) {
      if (!onIntro) router.replace("/intro");
      return;
    }

    // Leaving the intro goes straight to wherever they actually belong, not
    // via the tabs — bouncing through a screen they are not allowed on yet
    // shows a frame of it before the next redirect pulls it away.
    if (onIntro) {
      if (!isAuthenticated) router.replace("/login");
      else if (!onboarded) router.replace("/onboarding");
      else router.replace("/(tabs)");
      return;
    }

    if (!isAuthenticated) {
      if (!onAuthScreen) router.replace("/login");
      return;
    }

    if (!onboarded) {
      if (!onOnboarding) router.replace("/onboarding");
      return;
    }

    if (onAuthScreen || onOnboarding) router.replace("/(tabs)");
  }, [hydrated, introSeen, isAuthenticated, onboarded, segments, router]);

  return hydrated;
}
