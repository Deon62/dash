import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarHeight } from "@/theme/layout";
import { COLORS } from "@/theme/colors";

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * One sentence, over the bottom of the page, gone in a moment.
 *
 * For things the app wants to say and nobody has to answer. A sheet or a dialog
 * would be the wrong shape twice over: it takes over the screen for a remark,
 * and it makes the student dismiss something they did not ask for — which is a
 * lot of ceremony to tell somebody a button is not finished yet.
 *
 * It takes the same dark bar as `UndoBar` on purpose. That is the app's one
 * transient surface and the only dark thing in it, so the shape already means
 * "this will go away by itself" to anyone who has deleted a note. They stay
 * separate components because their lifecycles are not the same — an undo is
 * held open by pending work and carries an action, this is held open by a clock
 * and carries none — and merging them would put both sets of rules in one
 * place to be reasoned about at once.
 *
 * @param message   What to say, or empty/null to show nothing.
 * @param onHide    Called when the clock runs out. Clear the message here.
 * @param Icon      Optional glyph, for when the tap that raised this was on one.
 * @param iconColor Its colour — usually the colour of the control that raised
 *                  it, so the bar and the button read as the same event.
 * @param overTabs  Whether a tab bar sits underneath and has to be cleared.
 * @param duration  How long it stays.
 */
export default function Toast({
  message,
  onHide,
  Icon,
  iconColor = COLORS.primary,
  overTabs = false,
  duration = 3200,
}) {
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = message
      ? withSpring(1, SPRING)
      : withTiming(0, { duration: 140 });
  }, [message, shown]);

  useEffect(() => {
    if (!message) return undefined;

    // Keyed on the message itself, so a second tap while one is up restarts the
    // clock rather than letting the first one's timer close the second one
    // early — which reads as the app ignoring the tap.
    const timer = setTimeout(() => onHide?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onHide]);

  // Above the early return, because it is a hook: calling it inside the JSX
  // below would mean calling it only on the renders where there is a message,
  // and a hook that comes and goes between renders is the one thing React
  // cannot survive.
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 24 }],
  }));

  // Unmounted rather than merely transparent: a zero-opacity bar still sits in
  // the accessibility tree, and a screen reader reading out a message that is
  // not on screen is worse than no bar at all.
  if (!message) return null;

  return (
    <View
      // Never swallows a tap. Nothing here needs pressing, and a strip that
      // eats touches in the corner it happens to cover is a worse bug than the
      // one it was explaining.
      pointerEvents="none"
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
            backgroundColor: COLORS.ink,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
          },
          style,
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {Icon ? (
          <View className="mr-2.5">
            <Icon size={16} color={iconColor} />
          </View>
        ) : null}

        <Text
          style={{ color: COLORS.canvas, flex: 1 }}
          className="font-jk text-[13px] leading-[18px]"
        >
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}
