import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { BellOff, BellRing, CalendarClock } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import LinkRow from "@/components/LinkRow";
import Notice, { toneForError } from "@/components/Notice";
import { useStudyStore } from "@/store/useStudyStore";
import { saveSettings } from "@/lib/account";
import { registerForPush, usePushPermission } from "@/lib/push";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * Reminders are sent by the server, so the switch has to reach it.
 *
 * `saveSettings` writes the preference locally first and then to the account,
 * which is what makes the toggle move under a thumb rather than after a round
 * trip — and what makes the reminder actually stop arriving.
 *
 * The switches are only half the story, and the missing half is why this screen
 * grew. Both can be on, the server can be sending correctly, and nothing
 * arrives — because the OS permission was denied once, months ago, in a dialog
 * nobody remembers. That state used to be invisible here, so the only evidence
 * was silence, which reads as a broken app rather than a revocable permission.
 */
export default function NotificationSettingsScreen() {
  const settings = useStudyStore((state) => state.settings);

  const { status, refresh } = usePushPermission();
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // Re-read on every visit. Permission is changed in the OS settings app, so
  // the student can come back to this screen having fixed it elsewhere and
  // must not be told it is still denied.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const granted = status?.granted === true || status?.status === "granted";

  // Denied *and* undeniable: iOS only shows its prompt once, and Android after
  // two refusals. From then on the only way through is the OS settings app,
  // which is a different sentence from "we have not asked yet".
  const mustUseSettings = !granted && status?.canAskAgain === false;

  const ask = async () => {
    impact("medium");
    setBusy(true);
    setNotice(null);

    if (mustUseSettings) {
      setBusy(false);
      // `openSettings` lands on this app's own page, which is as close as any
      // app is allowed to get to the notification switch itself.
      Linking.openSettings().catch(() => {});
      return;
    }

    const { reason } = await registerForPush();
    await refresh();
    setBusy(false);

    if (reason === "denied") {
      setNotice({
        tone: "error",
        title: "Notifications are switched off",
        message:
          "Turn them on for ALS in your phone's settings and reminders will start arriving.",
      });
    }
  };

  return (
    <Screen bare>
      <ScreenHeader title="Notifications" />

      {notice ? (
        <Notice
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      {/* The permission, stated before the preferences that depend on it.
          Switches for reminders that the OS will never display are switches
          that lie, so this sits above them rather than in a footnote. */}
      {!granted ? (
        <Pressable
          onPress={ask}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Allow notifications"
          className="flex-row items-center rounded-2xl border border-line px-4 py-3.5 active:opacity-70"
        >
          <BellOff size={18} color={COLORS.flame} strokeWidth={1.8} />
          <View className="flex-1 ml-3.5">
            <Text className="font-jk-med text-ink text-[14.5px]">
              Reminders can't reach you yet
            </Text>
            <Text className="font-jk text-muted text-[12px] leading-[17px] mt-0.5">
              {mustUseSettings
                ? "Notifications are off for ALS. Tap to open your phone's settings."
                : "Tap to allow notifications on this phone."}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View>
        <LinkRow
          Icon={CalendarClock}
          label="Deadline reminders"
          hint="The evening before something is due"
          toggle
          toggleValue={settings.deadlineReminders}
          onToggle={(deadlineReminders) => saveSettings({ deadlineReminders })}
        />
        <LinkRow
          Icon={BellRing}
          label="Session reminders"
          hint="Fifteen minutes before a session starts"
          toggle
          toggleValue={settings.sessionReminders}
          onToggle={(sessionReminders) => saveSettings({ sessionReminders })}
          last
        />
      </View>
    </Screen>
  );
}
