import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import { impact } from "@/lib/haptics";
import { useRefillCountdown } from "@/lib/useRefillCountdown";

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
 *
 * `upgradable: false` on a verdict removes the plans button entirely. Not every
 * ceiling is for sale — the course-unit cap is the same on every tier and no
 * payment lifts it — and offering to fix one of those with money is worse than
 * offering nothing: it takes a student to the paywall for a product that does
 * not exist, and they only find that out after reading three cards.
 */
export default function LimitSheet({ verdict, onClose }) {
  const router = useRouter();
  const refillsIn = useRefillCountdown();

  const upgradable = verdict?.upgradable !== false;

  return (
    <Sheet
      visible={Boolean(verdict)}
      onClose={onClose}
      title="You have hit a limit"
      subtitle={verdict?.detail}
    >
      <View className="gap-y-3">
        {/* Only for the limits that actually come back. A lifetime ceiling
            offers no "next month", and saying otherwise sends someone away to
            wait for something that is never going to happen. */}
        {verdict?.refills ? (
          <Text className="font-jk text-muted text-[13px] -mt-1">
            Everything refills on the 1st — in {refillsIn}.
          </Text>
        ) : null}

        {upgradable ? (
          <Button
            label="See plans"
            onPress={() => {
              onClose();
              router.push("/billing");
            }}
          />
        ) : null}

        {/* Promoted to the primary control when there is no plans button above
            it, so the sheet still closes on something that looks pressable
            rather than on a grey word floating alone. */}
        {upgradable ? (
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
        ) : (
          <Button label="Got it" variant="outline" onPress={onClose} />
        )}
      </View>
    </Sheet>
  );
}
