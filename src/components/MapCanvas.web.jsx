import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * Web stand-in for MapCanvas.
 *
 * `react-native-maps` is native-only — importing it on web fails the bundle —
 * and Metro picks this file automatically for the web platform. It draws the
 * same ground and beacon so layout and navigation stay verifiable in a browser;
 * the live map is Android/iOS only.
 */

function PulseRing({ delay = 0 }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [t]);

  const style = useAnimatedStyle(() => {
    const p = (t.value + delay) % 1;
    return {
      opacity: 0.28 * (1 - p),
      transform: [{ scale: 0.3 + p * 2.6 }],
    };
  });

  return (
    <Animated.View
      style={style}
      className="absolute h-24 w-24 rounded-full bg-[#2563EB]"
    />
  );
}

export default function MapCanvas() {
  return (
    <View
      // Approximates the Google basemap ground so the stand-in reads the same.
      className="absolute inset-0 items-center justify-center bg-[#F2EFE9]"
      accessibilityLabel="Map"
    >
      <PulseRing />
      <PulseRing delay={0.5} />
      <View className="h-[18px] w-[18px] rounded-full border-[3px] border-white bg-[#2563EB]" />
    </View>
  );
}
