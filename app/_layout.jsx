import "../global.css";
import "@/lib/cssInterop";

import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { useStudyStore } from "@/store/useStudyStore";
import { useSessionGuard } from "@/lib/useSessionGuard";

/**
 * Guards the routes. A component rather than a hook call in RootLayout so it
 * mounts only once the navigator exists — redirecting before there is anything
 * to redirect within does nothing.
 */
function SessionGuard() {
  useSessionGuard();
  return null;
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
  if (!ready && !timedOut) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          <Stack.Screen name="login" options={{ animation: "fade" }} />
          <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        </Stack>
        <SessionGuard />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
