import { Pressable, Text, View } from "react-native";
import { ArrowDownToLine } from "lucide-react-native";

import Disc from "@/components/Disc";
import { COLORS } from "@/theme/colors";
import { dismissUpdate, openStore, useUpdatePrompt } from "@/lib/appUpdate";
import { impact } from "@/lib/haptics";

/**
 * A newer build is in the store. Nothing has stopped working.
 *
 * The quiet half of the pair — `UpdateGate` is the other. That distinction is
 * the whole design: being behind is not a reason to interrupt anybody, so this
 * is a card on the dashboard that a student can wave away and carry on.
 *
 * The dismissal is remembered against `latest_version`, so waving away 1.5.0
 * does not also swallow 1.6.0 three weeks later — which is how a card ends up
 * being shown exactly once in the life of an install and every release after it
 * arriving in silence.
 *
 * It shows the release notes rather than a version number on its own. "Quizzes
 * no longer lose your place" is a reason to update; "1.5.0 is available" is a
 * fact about a number.
 */
export default function UpdateCard() {
  const update = useUpdatePrompt();

  if (!update.available) return null;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`A new version is available. ${update.notes}`}
    >
      <View className="flex-row">
        <Disc size={34} tone="none">
          <ArrowDownToLine size={19} color={COLORS.primary} strokeWidth={1.8} />
        </Disc>

        <View className="flex-1 ml-2.5">
          <Text className="font-jk-semi text-ink text-[14.5px] leading-[20px]">
            {update.version ? `Version ${update.version} is out` : "A new version is out"}
          </Text>
          <Text className="font-jk text-muted text-[13px] leading-[19px] mt-1.5">
            {update.notes || "Updating takes a moment and keeps everything as it is."}
          </Text>

          {/* Both controls are text, matching `Notice`. A filled button on the
              dashboard would outrank the calendar, and the calendar is what the
              student opened the app for. */}
          <View className="flex-row items-center gap-x-5 mt-3.5">
            <Pressable
              onPress={() => {
                impact("light");
                openStore(update.storeUrl);
              }}
              accessibilityRole="button"
              accessibilityLabel="Update now"
              hitSlop={8}
              className="active:opacity-60"
            >
              <Text className="font-jk-med text-primary text-[13.5px]">Update</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                impact("light");
                dismissUpdate(update.version);
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              hitSlop={8}
              className="active:opacity-60"
            >
              <Text className="font-jk-med text-muted text-[13.5px]">Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
