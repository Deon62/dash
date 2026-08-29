import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { BellOff, BellRing, CalendarClock, Send } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import LinkRow from "@/components/LinkRow";
import Notice, { toneForError } from "@/components/Notice";
import { useStudyStore } from "@/store/useStudyStore";
import { saveSettings } from "@/lib/account";
import { registerForPush, sendTestPush, usePushPermission } from "@/lib/push";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

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

  /**
   * Fires a real notification at every device on the account.
   *
   * Shipped, not hidden behind a development flag. Three things have to line up
   * before a reminder arrives — a registered token, credentials Expo accepts,
   * and an OS permission — and when one is missing the only symptom is silence
   * weeks later, on the evening something was due. This is the one control that
   * tells the three apart, and it reads the server's own counts to do it.
   *
   * It also has to be usable in a release build, which is the only honest place
   * to test push: a notification is about an app you are *not* looking at, and
   * a development client with Metro attached is the one environment where that
   * is hard to arrange.
   */
  const test = async () => {
    impact("medium");
    setBusy(true);
    setNotice(null);

    const { delivered, hasDevices, error } = await sendTestPush();
    setBusy(false);

    if (error) {
      setNotice({
        tone: toneForError(error),
        title: "Couldn't send a test",
        message: error,
      });
      return;
    }

    if (!hasDevices) {
      setNotice({
        tone: "error",
        title: "This phone isn't registered",
        message:
          "No push token has reached the account. Permission was denied, or this build has no notification credentials.",
      });
      return;
    }

    if (delivered === 0) {
      setNotice({
        tone: "error",
        title: "Expo wouldn't take it",
        message:
          "A token is stored but the push service rejected it — usually FCM credentials missing from the Expo project, or a token left behind by an uninstalled build.",
      });
      return;
    }

    notify("success");
    setNotice({
      tone: "info",
      title: `Sent to ${delivered} ${delivered === 1 ? "device" : "devices"}`,
      message:
        "If nothing appears within a few seconds, it is credentials or the OS permission rather than the server.",
    });
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
        />

        <LinkRow
          Icon={Send}
          label="Send a test notification"
          hint="Checks reminders can actually reach this phone"
          onPress={test}
          last
        />
      </View>
    </Screen>
  );
}
