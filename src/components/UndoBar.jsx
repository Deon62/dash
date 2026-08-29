import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarHeight } from "@/theme/layout";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * "Deleted · Undo", over the bottom of the page.
 *
 * Dark rather than white, and the only dark surface in the app. That is
 * deliberate: it is the one element that is temporary and that has to be
 * noticed within a few seconds without a student having been looking for it.
 * A white card on a white page would be missed exactly as often as it needs to
 * be seen.
 *
 * It does not block anything underneath. An undo strip that swallows taps in
 * the corner it happens to cover is worse than the mistake it exists to fix.
 *
 * @param pending  `{ label }` while a delete is waiting, else null.
 * @param onUndo   Puts it back.
 * @param overTabs Whether a tab bar sits underneath and has to be cleared.
 */
export default function UndoBar({ pending, onUndo, overTabs = false }) {
  const insets = useSafeAreaInsets();

  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = pending
      ? withSpring(1, SPRING)
      : withTiming(0, { duration: 140 });
  }, [pending, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 24 }],
  }));

  // Unmounted rather than merely transparent when there is nothing to say: a
  // zero-opacity bar still sits in the accessibility tree, and a screen reader
  // announcing "Undo" over an empty page is worse than no bar at all.
  if (!pending) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: (overTabs ? getTabBarHeight(insets) : Math.max(insets.bottom, 16)) + 12,
      }}
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: COLORS.ink,
            borderRadius: 14,
            paddingLeft: 16,
            paddingRight: 8,
            paddingVertical: 10,
          },
          style,
        ]}
      >
        <Text
          numberOfLines={1}
          style={{ color: COLORS.canvas, flex: 1 }}
          className="font-jk text-[13px]"
        >
          {pending.label}
        </Text>

        <Pressable
          onPress={() => {
            impact("light");
            onUndo();
          }}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          hitSlop={12}
          className="px-3 py-1.5 rounded-lg active:opacity-60"
        >
          <Text className="font-jk-semi text-[13px]" style={{ color: COLORS.primary }}>
            Undo
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
