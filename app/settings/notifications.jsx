import { View } from "react-native";
import { BellRing, CalendarClock } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import LinkRow from "@/components/LinkRow";
import { useStudyStore } from "@/store/useStudyStore";
import { saveSettings } from "@/lib/account";

/**
 * Reminders are sent by the server, so the switch has to reach it.
 *
 * `saveSettings` writes the preference locally first and then to the account,
 * which is what makes the toggle move under a thumb rather than after a round
 * trip — and what makes the reminder actually stop arriving.
 */
export default function NotificationSettingsScreen() {
  const settings = useStudyStore((state) => state.settings);

  return (
    <Screen bare>
      <ScreenHeader title="Notifications" />

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
