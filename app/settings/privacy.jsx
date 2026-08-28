import { Text, View } from "react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";

/** Plain statements of what is true today, not a policy template. */
const POINTS = [
  {
    title: "Your coursework is on your account",
    body: "Units, timetable, notes, deadlines and chats are stored against your account so they follow you to any phone you sign in on. A copy is kept on this device too, which is what lets the app work with no signal.",
  },
  {
    title: "The tutor reads your material to answer",
    body: "A question is sent to our server, which finds the relevant passages in what you have filed and asks a language model to answer using them. The model is given those passages and your question, and nothing else from your account.",
  },
  {
    title: "Files are stored privately",
    body: "A PDF or photo you add is uploaded to private storage. It is reached through links that are created when you open it and expire shortly after, so a link that leaks stops working.",
  },
  {
    title: "Signing in identifies the account",
    body: "Your phone number, or your Google address, is what your account is filed under. Signing in on a new phone signs the old one out. One account, one device at a time.",
  },
  {
    title: "Deleting is deleting",
    body: "Delete account, in Settings, removes your profile, units, timetable, knowledge and chats from our servers as well as from this phone.",
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
