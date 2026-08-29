import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";

import { useStudyStore } from "@/store/useStudyStore";

/**
 * Routes reachable without a session.
 *
 * `oauthredirect` is one of them for a moment rather than as a destination:
 * Google's redirect arrives as a deep link, Expo Router navigates to it, and
 * the code is still being exchanged. Bouncing that to /login would land on the
 * sign-in screen a beat before the session it is waiting for, which reads as
 * the sign-in having failed. Being an auth route also means the guard sweeps
 * off it the instant the session lands — see the last line of the effect.
 */
const AUTH_ROUTES = new Set(["login", "verify", "oauthredirect"]);

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
  const onboardedFlag = useStudyStore((state) => state.onboarded);
  const name = useStudyStore((state) => state.profile.name);

  /**
   * Whether anything has been filed yet.
   *
   * Only read to decide where finishing intake lands — see the last lines of
   * the effect. A count rather than the list, so this does not re-run the
   * guard every time a note is added.
   */
  const hasMaterial = useStudyStore((state) => state.materials.length > 0);

  /**
   * Intake is done if the flag says so — or if the account plainly shows it.
   *
   * The flag alone is one stored boolean between a student and their own
   * coursework, and if anything ever loses it they are sent back through a
   * form they have already filled in, on every launch, with no way out that
   * they can find. A profile with a name on it is proof the form was
   * completed, on this phone or another one, and it cannot be lost without
   * the name going too.
   */
  const onboarded = onboardedFlag || name.trim().length > 0;

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
    //
    // Only a visitor, though. Someone already signed in has an account, so
    // being shown the pitch for having one is at best strange and at worst a
    // loop they cannot leave — which is exactly what it looks like if the flag
    // is ever lost while the session survives.
    if (!introSeen && !isAuthenticated) {
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

    if (onAuthScreen || onOnboarding) {
      /**
       * Finishing intake lands on Knowledge, not on the calendar.
       *
       * The app's claim is that the tutor has read *your* material, and it is
       * unprovable until a student has filed something. Intake used to end on
       * the month view — empty, because they have not added a deadline either
       * — leaving them to work out for themselves what the app was for. The
       * unit list they just typed in is on Knowledge, and the next useful
       * action is right there under the button.
       *
       * Only on the way out of intake, and only while nothing is filed. A
       * student who has material has a home screen like everyone else, and a
       * sign-in should always land where they left off.
       */
      const start = onOnboarding && !hasMaterial;
      router.replace(start ? "/(tabs)/knowledge?start=1" : "/(tabs)");
    }
  }, [hydrated, introSeen, isAuthenticated, onboarded, hasMaterial, segments, router]);

  return hydrated;
}
