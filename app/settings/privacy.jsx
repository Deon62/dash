import { Pressable, Text, View } from "react-native";
import { ExternalLink } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import { COLORS } from "@/theme/colors";
import { PRIVACY_URL, openLegal } from "@/lib/legal";

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

      {/* The full policy, at the foot rather than the head of the page.

          What is above is the plain-English version, and it is what somebody
          opening this screen actually wants — leading with a link off to a
          legal page would send them away from the answer to read the long form
          of it. This is here for the person who wants the binding text, and
          for the version a student agreed to, which lives on the web so that
          changing it does not need a release.

          The URL is printed rather than hidden behind "Privacy Policy". A link
          you cannot see the destination of is worth less on a page about
          trust, and it is also what somebody types into a laptop later. */}
      <Pressable
        onPress={() => openLegal(PRIVACY_URL)}
        accessibilityRole="link"
        accessibilityLabel="Read the full privacy policy at als.ardena.co.ke"
        className="border-t border-hairline pt-5 active:opacity-60"
      >
        <Text className="font-jk-med text-ink text-[13.5px]">
          The full privacy policy
        </Text>

        <View className="flex-row items-center mt-1.5">
          <Text className="font-jk text-primary text-[13px]">{PRIVACY_URL}</Text>
          <View className="ml-1.5">
            <ExternalLink size={13} color={COLORS.primary} strokeWidth={1.9} />
          </View>
        </View>
      </Pressable>
    </Screen>
  );
}
