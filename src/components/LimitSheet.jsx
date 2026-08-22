import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import { impact } from "@/lib/haptics";

/**
 * What a student sees when a plan limit stops them.
 *
 * One component for every refusal in the app. The verdict from `lib/quota`
 * carries its own wording, so this never has to know which limit was hit —
 * which is also what keeps the message and the rule that produced it from
 * drifting apart.
 *
 * There is always a way out that is not "pay": a limit that traps someone on a
 * screen is a bug, not a business model.
 */
export default function LimitSheet({ verdict, onClose }) {
  const router = useRouter();

  return (
    <Sheet
      visible={Boolean(verdict)}
      onClose={onClose}
      title="You have hit a limit"
      subtitle={verdict?.detail}
    >
      <View className="gap-y-3">
        <Button
          label="See plans"
          onPress={() => {
            onClose();
            router.push("/billing");
          }}
        />

        <Pressable
          onPress={() => {
            impact("light");
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          className="items-center py-3 active:opacity-60"
        >
          <Text className="font-jk-med text-muted text-[14px]">Not now</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
