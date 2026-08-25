import { View } from "react-native";
import { BellRing, CalendarClock } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import LinkRow from "@/components/LinkRow";
import { useStudyStore } from "@/store/useStudyStore";

export default function NotificationSettingsScreen() {
  const settings = useStudyStore((state) => state.settings);
  const updateSettings = useStudyStore((state) => state.updateSettings);

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
          onToggle={(deadlineReminders) => updateSettings({ deadlineReminders })}
        />
        <LinkRow
          Icon={BellRing}
          label="Session reminders"
          hint="Fifteen minutes before a session starts"
          toggle
          toggleValue={settings.sessionReminders}
          onToggle={(sessionReminders) => updateSettings({ sessionReminders })}
          last
        />
      </View>

    </Screen>
  );
}
