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
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

// Hold the splash until the editorial typeface is in memory — swapping fonts
// mid-render is very visible with type this large.
SplashScreen.preventAutoHideAsync().catch(() => {});

// If font loading neither resolves nor rejects, render anyway. Without this the
// splash stays up forever and the app looks like it never booted.
const FONT_TIMEOUT_MS = 2500;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  const ready = fontsLoaded || Boolean(fontError) || timedOut;

  // Hide from an effect, not from the root view's onLayout: that view only
  // mounts once `ready` is true, so a stalled load could never reach it.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Degrade to the system face rather than stranding the user on a splash.
  if (!ready) return null;

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
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="wrapped" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
