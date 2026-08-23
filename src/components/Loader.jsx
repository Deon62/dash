import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/theme/colors";

/**
 * ScaleLoader, rebuilt for React Native.
 *
 * `react-spinners` is a web library — it animates with CSS keyframes through
 * emotion, and none of that exists here. This is the same motion (a row of
 * bars stretching and shrinking on a stagger) driven by Reanimated instead, so
 * it runs on the UI thread and keeps going while JS is busy doing the thing
 * being waited on. A spinner that freezes exactly when the app gets busy is
 * worse than no spinner.
 */

const BAR_COUNT = 5;
const CYCLE_MS = 1000;

/** Matches the original's rhythm: each bar starts a beat after the last. */
const STAGGER_MS = 100;

function Bar({ index, height, width, gap, color }) {
  const scale = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        // The delay is baked in as a held frame rather than a `withDelay`
        // wrapper, so every bar's loop is the same length and they never
        // drift apart over a long wait.
        withTiming(0.4, { duration: index * STAGGER_MS }),
        withTiming(1, { duration: CYCLE_MS / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: CYCLE_MS / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, {
          duration: (BAR_COUNT - index) * STAGGER_MS,
        })
      ),
      -1,
      false
    );
  }, [index, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          marginHorizontal: gap / 2,
          borderRadius: width / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function Loader({
  size = "md",
  color = COLORS.primary,
  label,
  center = false,
}) {
  const small = size === "sm";
  const height = small ? 22 : 34;
  const width = small ? 3 : 4;
  const gap = small ? 3 : 4;

  return (
    <View className={center ? "flex-1 items-center justify-center py-10" : "items-center"}>
      <View style={{ flexDirection: "row", height, alignItems: "center" }}>
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <Bar
            key={index}
            index={index}
            height={height}
            width={width}
            gap={gap}
            color={color}
          />
        ))}
      </View>

      {label ? (
        <Text className="font-jk text-muted text-[13px] mt-4">{label}</Text>
      ) : null}
    </View>
  );
}

/**
 * A full-page wait.
 *
 * Used where a screen has nothing to show until a request lands. Deliberately
 * not an overlay: dimming content that is not there yet just makes the wait
 * look like a failure.
 */
export function PageLoader({ label = "Loading…" }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <Loader label={label} />
    </View>
  );
}

/** Sits inside a button or a row that is already the right size. */
export function InlineLoader({ color }) {
  return <Loader size="sm" color={color} />;
}
