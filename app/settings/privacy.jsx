import { Text, View } from "react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";

/** Plain statements of what is true today, not a policy template. */
const POINTS = [
  {
    title: "Everything is on this phone",
    body: "Your units, timetable, notes, deadlines and chats are written to this device's storage.",
  },
  {
    title: "Nothing leaves for a model",
    body: "The tutor searches your notes on the device and quotes them back.",
  },
  {
    title: "Files stay where you put them",
    body: "A PDF or photo you add is copied into the app's own storage so the link keeps working. Deleting the app deletes those copies.",
  },
  {
    title: "Sign-in is offline",
    body: "Your phone number identifies your account and is stored on this device.",
  },
];

export default function PrivacyScreen() {
  return (
    <Screen bare>
      <ScreenHeader title="Privacy" />

      <View className="gap-y-6">
        {POINTS.map((point) => (
          <View key={point.title}>
            <Text className="font-jk-semi text-ink text-[15px]">{point.title}</Text>
            <Text className="font-jk text-muted text-[13.5px] leading-[20px] mt-1.5">
              {point.body}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
