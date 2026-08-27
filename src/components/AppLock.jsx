import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Pressable, Text, View } from "react-native";

import { useStudyStore } from "@/store/useStudyStore";
import { authenticate } from "@/lib/biometrics";
import { COLORS } from "@/theme/colors";

/**
 * The fingerprint or face lock, actually applied.
 *
 * The switch in Settings has existed for a while and did nothing but save a
 * preference — which is the worst possible state for a security control to be
 * in, because someone who turned it on believed their coursework was covered
 * and it was not. This is the part that reads it.
 *
 * Rendered over the navigator rather than in place of it. Unmounting the
 * routes would throw away every screen's state and drop the student back at
 * the tabs when they unlock; a cover keeps them exactly where they were.
 *
 * It guards the *view*, not the data — see `src/lib/biometrics.js`. A borrowed
 * phone does not show someone's notes. It is not a claim about anyone with the
 * handset, a cable and an afternoon.
 */

/**
 * How long the app may sit in the background before it locks again.
 *
 * Not zero. Answering a notification, glancing at the time, or the OS's own
 * biometric sheet all count as leaving the app, and a lock that fires on every
 * one of those is a lock people turn off within a day. Long enough to be
 * usable, short enough that a phone left on a desk is covered.
 */
const GRACE_MS = 20000;

export default function AppLock() {
  const enabled = useStudyStore((state) => state.settings.biometricLock);
  const isAuthenticated = useStudyStore((state) => state.isAuthenticated);
  const hydrated = useStudyStore((state) => state.hydrated);

  const armed = hydrated && enabled && isAuthenticated;

  // Locked from the first render when armed, never later by default: a screen
  // that appears unlocked and then covers itself a moment afterwards has
  // already shown what it was meant to hide.
  const [locked, setLocked] = useState(armed);
  const [refused, setRefused] = useState(false);

  // The system's own prompt takes the app out of the foreground on both
  // platforms. Without this, showing it would look like leaving the app, which
  // would arm the lock again and prompt on top of the prompt.
  const prompting = useRef(false);
  const leftAt = useRef(null);

  const unlock = useCallback(async () => {
    if (prompting.current) return;

    prompting.current = true;
    setRefused(false);

    const result = await authenticate("Unlock ALS");

    prompting.current = false;

    if (result.ok) setLocked(false);
    else setRefused(true);
  }, []);

  // Arm as soon as the setting is turned on from a state where it was not —
  // but do not cover the screen the student is standing on to do it. The next
  // return from the background is when it starts applying.
  useEffect(() => {
    if (!armed) setLocked(false);
  }, [armed]);

  // Ask the moment the cover goes up, so the common case is a thumb already on
  // the sensor rather than a screen with a button to find.
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (prompting.current) return;

      if (next !== "active") {
        leftAt.current = Date.now();
        return;
      }

      const away = leftAt.current;
      leftAt.current = null;

      if (!away || Date.now() - away < GRACE_MS) return;
      if (!useStudyStore.getState().settings.biometricLock) return;
      if (!useStudyStore.getState().isAuthenticated) return;

      setLocked(true);
    });

    return () => subscription.remove();
  }, []);

  if (!locked) return null;

  return (
    <View
      // Above everything, including any open sheet or modal.
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityViewIsModal
    >
      <Image
        source={require("../../assets/splash-icon.png")}
        style={{ width: 130, height: 82 }}
        resizeMode="contain"
      />

      {/* Only after a refusal. Prompting and immediately offering a button to
          prompt again reads as the first one having failed. */}
      {refused ? (
        <Pressable
          onPress={unlock}
          accessibilityRole="button"
          accessibilityLabel="Unlock ALS"
          className="mt-10 rounded-full px-6 py-3 active:opacity-70"
          style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
        >
          <Text className="font-jk-med text-[14px]" style={{ color: COLORS.canvas }}>
            Unlock
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
