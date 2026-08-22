import { Text, View } from "react-native";
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
      <ScreenHeader
        title="Notifications"
        description="What the app is allowed to interrupt you for."
      />

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
          label="Class reminders"
          hint="Fifteen minutes before a session starts"
          toggle
          toggleValue={settings.classReminders}
          onToggle={(classReminders) => updateSettings({ classReminders })}
          last
        />
      </View>

      <Text className="font-jk text-muted text-[11.5px] leading-[17px] -mt-3">
        These are saved as preferences. Delivering them needs
        expo-notifications and a scheduling pass, which is not wired up yet —
        nothing will buzz until it is.
      </Text>
    </Screen>
  );
}
