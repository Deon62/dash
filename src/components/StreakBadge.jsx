import { Pressable, Text } from "react-native";
import { Flame } from "lucide-react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";
import { CHROME_SCALE } from "@/theme/type";

/**
 * Days in a row, as a flame and a number.
 *
 * A pill rather than a disc, because the count has to sit next to the flame —
 * a streak with the number hidden behind a tap is not a streak, it is a
 * decoration. Cold until the first day is on the board: an unlit flame reading
 * "0" is a worse greeting than no flame at all.
 */
export default function StreakBadge({ days, onPress }) {
  const lit = days > 0;

  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={
        lit ? `${days} day streak` : "No streak yet. Revise today to start one"
      }
      hitSlop={6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        columnGap: 5,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
      }}
      className="active:opacity-60"
    >
      <Flame
        size={17}
        color={lit ? COLORS.flame : COLORS.muted}
        strokeWidth={2}
        // Filled once it is burning. An outline flame at a glance reads as an
        // icon; a solid one reads as lit.
        fill={lit ? COLORS.flame : "transparent"}
      />
      <Text
        maxFontSizeMultiplier={CHROME_SCALE}
        style={{ color: lit ? COLORS.ink : COLORS.muted }}
        className="font-jk-semi text-[13.5px]"
      >
        {days}
      </Text>
    </Pressable>
  );
}
