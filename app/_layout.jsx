import "../global.css";
import "@/lib/cssInterop";

import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { PostHogProvider } from "posthog-react-native";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { useStudyStore } from "@/store/useStudyStore";
import { useSessionGuard } from "@/lib/useSessionGuard";
import { useAccountSync } from "@/lib/bootstrap";
import { usePushRegistration, usePushTaps } from "@/lib/push";
import AppLock from "@/components/AppLock";
import UpdateGate from "@/components/UpdateGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  analyticsEnabled,
  AnalyticsBridge,
  IdentitySync,
  POSTHOG_AUTOCAPTURE,
  POSTHOG_KEY,
  POSTHOG_OPTIONS,
  ScreenTracker,
} from "@/lib/analytics";
import { COLORS } from "@/theme/colors";

/**
 * Guards the routes. A component rather than a hook call in RootLayout so it
 * mounts only once the navigator exists — redirecting before there is anything
 * to redirect within does nothing.
 */
function SessionGuard() {
  useSessionGuard();
  return null;
}

/**
 * Keeps the device level with the account: on sign-in, on cold start, and on
 * coming back from the background. A component for the same reason as the
 * guard — it belongs below the navigator, not in the layout's own body.
 */
function AccountSync() {
  useAccountSync();
  return null;
}

/**
 * Push: hand the server a token, and route what gets tapped.
 *
 * Below the navigator for the same reason as the guard — a tap on a reminder
 * has to `push` a route, and there is nothing to push onto until the navigator
 * exists. Registration could sit anywhere; keeping the pair together means
 * there is one place to look for anything to do with notifications.
 */
function Push() {
  const router = useRouter();

  usePushRegistration();
  usePushTaps(router);

  return null;
}

/**
 * Wraps the app in PostHog when a project key is configured, and gets out of
 * the way when one is not — Expo Go, a fresh clone, or anyone who would rather
 * not send events while developing.
 *
 * It sits above the navigator because the touch autocapture works by catching
 * `onTouchEndCapture` on a wrapper View: anything rendered outside it is
 * invisible to analytics.
 */
function Analytics({ children }) {
  // Wrapped rather than returned bare: `children` is several elements now, and
  // returning that array directly is what makes React ask for keys on static
  // JSX that has no business having any.
  if (!analyticsEnabled) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={POSTHOG_OPTIONS}
      autocapture={POSTHOG_AUTOCAPTURE}
    >
      {children}
    </PostHogProvider>
  );
}

/**
 * What fills the screen between the native splash and the first route.
 *
 * The same dark ground and the same wordmark, so the handover is invisible:
 * the native splash goes away, this is already underneath it, and the app
 * appears when it is genuinely ready. Returning `null` here — which is what
 * this used to do — meant a white flash between a dark splash and a dark
 * splash, which reads as the app having crashed and restarted.
 */
function Booting() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("../assets/splash-icon.png")}
        style={{ width: 150, height: 94 }}
        resizeMode="contain"
      />
    </View>
  );
}

// Hold the splash until the editorial typeface is in memory — swapping fonts
// mid-render is very visible with type this large.
SplashScreen.preventAutoHideAsync().catch(() => {});

// If font loading neither resolves nor rejects, render anyway. Without this the
// splash stays up forever and the app looks like it never booted.
const BOOT_TIMEOUT_MS = 2500;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Holding the splash until the store is back from disk as well keeps a
  // signed-in student from seeing the login screen flash past on cold start.
  const hydrated = useStudyStore((state) => state.hydrated);

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && hydrated;

  // Hide from an effect, not from the root view's onLayout: that view only
  // mounts once we render, so a stalled load could never reach it.
  useEffect(() => {
    if (ready || timedOut) SplashScreen.hideAsync().catch(() => {});
  }, [ready, timedOut]);

  // Degrade to the system face rather than stranding the user on a splash.
  if (!ready && !timedOut) return <Booting />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Analytics>
        {/* Outside the boundary, deliberately. React unmounts a boundary's
            children before `componentDidCatch` runs, so a bridge among them
            would have let go of the client at the exact moment the crash
            needed reporting. */}
        <AnalyticsBridge />

        {/* Inside `Analytics`, so a crash is reported through the client that
            is already configured, and outside everything else, so there is no
            screen it cannot catch. A React error unmounts the whole tree —
            without this the student is left on white with no way back but
            force-quitting, and if the fault is reached while the store
            rehydrates, force-quitting lands them on white again. */}
        <ErrorBoundary>
          <SafeAreaProvider>
            <StatusBar style="dark" backgroundColor="#FFFFFF" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFFFFF" },
              }}
            >
              {/* Only screens that need non-default options are declared. Expo
                  Router registers the rest from the file tree, so adding a page
                  does not mean remembering to list it here. */}
              <Stack.Screen name="intro" options={{ animation: "fade" }} />
              <Stack.Screen name="login" options={{ animation: "fade" }} />
              <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
            </Stack>
            <SessionGuard />
            <AccountSync />
            <Push />

            {/* Below the navigator: the screen tracker reads the current route
                segments, and there are none until one exists. */}
            {analyticsEnabled && (
              <>
                <ScreenTracker />
                <IdentitySync />
              </>
            )}

            {/* Over the navigator, not instead of it: unmounting the routes to
                show a lock would throw away every screen's state and drop the
                student back at the tabs when they unlock. */}
            <AppLock />

            {/* Above the lock, and the only thing that is. A build the server
                has disowned cannot be usefully unlocked into — and this is the
                one prompt in the app that has to work for somebody who cannot
                sign in, which is why the release check it mounts needs no
                token. */}
            <UpdateGate />
          </SafeAreaProvider>
        </ErrorBoundary>
      </Analytics>
    </GestureHandlerRootView>
  );
}
