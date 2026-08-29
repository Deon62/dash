import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import { usePostHog } from "posthog-react-native";

import { useStudyStore } from "@/store/useStudyStore";

/**
 * PostHog wiring: what people tapped, what screens they reached, and what
 * crashed on the way.
 *
 * The key is a *public* project key — it only allows writing events, never
 * reading them — so it belongs in `EXPO_PUBLIC_` alongside the Google client
 * ids rather than in a secret store. Without it every export here degrades to
 * a no-op, which is what keeps Expo Go and a fresh clone working with no
 * PostHog account at all.
 */
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";

// Region matters: a key issued in the EU cloud is rejected by the US host and
// the events vanish with a 401 nobody reads. Set this to whichever region the
// project was created in.
export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const analyticsEnabled = Boolean(POSTHOG_KEY);

export const POSTHOG_OPTIONS = {
  host: POSTHOG_HOST,

  // Screen recordings. Also has to be switched on in the PostHog project
  // settings ("Record user sessions") — the client flag alone does nothing.
  enableSessionReplay: true,
  sessionReplayConfig: {
    // Both default to true; they are spelled out because this app records
    // students' coursework and profile photos, and a future SDK default that
    // flipped would silently start uploading it.
    maskAllTextInputs: true,
    maskAllImages: true,
    maskAllSandboxedViews: true,

    captureLog: true,

    // One screenshot per second. Lower is smoother and much heavier on both
    // battery and the monthly recording quota.
    throttleDelayMs: 1000,
  },

  errorTracking: {
    autocapture: {
      uncaughtExceptions: true,
      unhandledRejections: true,

      // Native Android/iOS crashes, the ones a JS error boundary never sees.
      // Needs `@posthog/react-native-plugin`, so this is dead in Expo Go and
      // live in any dev-client or EAS build.
      nativeCrashes: true,

      // `warn` is deliberately absent: React Native warns constantly about
      // things that are not bugs, and each one would spend an exception from
      // the monthly allowance.
      console: ["error"],
    },
  },

  captureAppLifecycleEvents: true,
};

export const POSTHOG_AUTOCAPTURE = {
  // The reason we are here. Off by default in the SDK.
  captureTouches: true,

  // expo-router does not expose the NavigationContainer the SDK's own tracker
  // hooks into, so its screen capture cannot see route changes. `ScreenTracker`
  // below does the job instead; leaving this on would only add a warning.
  captureScreens: false,

  // The SDK default includes `children`, which lifts the rendered text of
  // whatever was tapped into the event. On this app that text is often the
  // student's own note or unit title, so it is dropped and readable names come
  // from `testID` / `accessibilityLabel` / an explicit `ph-label` prop instead.
  propsToCapture: ["testID", "accessibilityLabel", "ph-label"],
};

/**
 * The screen name for a set of expo-router segments.
 *
 * `useSegments()` gives the route *pattern* — `["unit", "[id]"]` — where
 * `usePathname()` would give `/unit/8f21…`. The pattern is what makes a funnel
 * possible: with the id substituted in, every student generates their own
 * unique screen name and nothing groups.
 *
 * Group segments like `(tabs)` are layout bookkeeping, not places a student
 * can be, so they are dropped.
 */
function screenName(segments) {
  const path = segments.filter((segment) => !segment.startsWith("(")).join("/");
  return path ? `/${path}` : "/";
}

/**
 * Reports screen views. A component rather than a hook call in the layout body
 * for the same reason as `SessionGuard`: it has to sit below the navigator,
 * because there are no segments to read until one exists.
 */
export function ScreenTracker() {
  const posthog = usePostHog();
  const segments = useSegments();

  const name = screenName(segments);

  useEffect(() => {
    if (!posthog) return;
    posthog.screen(name);
  }, [posthog, name]);

  return null;
}

/**
 * Ties events to the signed-in account, so a session on a phone and the same
 * student's session on a tablet are one person in the funnel.
 *
 * Only `userId` is sent. Name, email and phone stay out of PostHog: they are
 * not needed to answer "where did people press", and putting them here would
 * spread the account record into a system that has no business holding it.
 */
export function IdentitySync() {
  const posthog = usePostHog();
  const userId = useStudyStore((state) => state.userId);

  const previous = useRef(undefined);

  useEffect(() => {
    if (!posthog) return;

    const before = previous.current;
    previous.current = userId;

    if (userId) {
      posthog.identify(String(userId));
      return;
    }

    // Reset only on a real sign-out. Calling it whenever `userId` is null
    // would also fire on every cold start of a signed-out app, minting a new
    // anonymous id each launch and making one returning visitor look like many
    // first-time ones.
    if (before) posthog.reset();
  }, [posthog, userId]);

  return null;
}

// --- Reporting from outside the tree ----------------------------------------

/**
 * The client, reachable without a hook.
 *
 * `usePostHog` is the only supported way to get at it, and a hook cannot be
 * called from `componentDidCatch` — which is the one place in the app that has
 * to report, because it is the one place that knows the tree has just died.
 * The SDK's own `PostHogContext` would do it, but it is not exported from the
 * package index and the `exports` map blocks reaching for the file, so a deep
 * import would break silently on an SDK bump rather than loudly.
 */
let client = null;

/**
 * Publishes the client to `reportCrash`. Renders nothing.
 *
 * Belongs *outside* `ErrorBoundary` and inside `Analytics`. Outside, because a
 * bridge mounted among the boundary's children is unmounted by the fallback
 * render that precedes `componentDidCatch` — so the handle would be gone at
 * the exact moment it was needed.
 */
export function AnalyticsBridge() {
  const posthog = usePostHog();

  useEffect(() => {
    client = posthog ?? null;
    // Deliberately no teardown. There is nothing to leak — the provider lives
    // as long as the app — and clearing on unmount only creates a window in
    // which a crash goes unreported.
  }, [posthog]);

  return null;
}

/**
 * Reports an exception the tree could not recover from.
 *
 * Silent where analytics is off, which is Expo Go and any build with no
 * project key. Never throws: this runs on the path to the crash screen, and an
 * error here would replace a screen the student can act on with one they
 * cannot.
 */
export function reportCrash(error, properties = {}) {
  try {
    client?.captureException?.(error, properties);
  } catch {
    // Reporting is best-effort by definition. There is nobody left to tell.
  }
}
