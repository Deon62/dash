import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radar } from "lucide-react-native";

import { impact } from "@/lib/haptics";

/**
 * Shown when the detector thinks a trip has started but doesn't know the mode.
 *
 * Deliberately dismissible: guessing wrong and silently logging a ride is worse
 * than not logging it, so the user confirms or defers.
 */
export default function DetectionPrompt({ visible, onChoose, onLater }) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOut.duration(180)}
      style={{
        top: insets.top + 14,
        shadowColor: "#09090B",
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 14,
      }}
      className="absolute inset-x-4 z-20 rounded-3xl bg-white p-4"
    >
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-black">
          <Radar size={18} color="#FFFFFF" strokeWidth={2.2} />
        </View>
        <View className="flex-1 ml-3.5">
          <Text className="font-jk-black text-brand-black text-[15px]">
            Looks like you're moving
          </Text>
          <Text className="font-jk text-brand-muted text-[12px] mt-0.5">
            What are you travelling on?
          </Text>
        </View>
      </View>

      <View className="flex-row gap-x-2.5 mt-4">
        <Pressable
          onPress={() => {
            impact("light");
            onLater();
          }}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          className="flex-1 items-center justify-center rounded-2xl border border-brand-hairline py-3 active:opacity-70"
        >
          <Text className="font-jk-bold text-brand-slate text-[13px]">Not now</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            impact("medium");
            onChoose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose transport mode"
          className="flex-1 items-center justify-center rounded-2xl bg-brand-black py-3 active:opacity-85"
        >
          <Text className="font-jk-bold text-brand-white text-[13px]">Choose</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
