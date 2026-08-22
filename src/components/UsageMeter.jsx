import { Text, View } from "react-native";

import { COLORS } from "@/theme/colors";
import { UNLIMITED } from "@/theme/plans";

/**
 * One quota, as a bar.
 *
 * A bar answers "how much is left" at a glance, which is the only question
 * anyone opens this page with — a row of numbers makes you do the division
 * yourself. The figures stay on the right for anyone who wants them exactly.
 *
 * The track is always full width, so four meters stacked read as four
 * comparable lengths rather than four unrelated readings.
 */
export default function UsageMeter({ label, used, limit, unit, last = false }) {
  const unlimited = limit === UNLIMITED || limit === null;
  const ratio = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit);

  // Amber from three-quarters, red once it is gone. Nothing before that: a bar
  // that changes colour at 40% teaches you to ignore the colour.
  const fill =
    unlimited || ratio < 0.75
      ? COLORS.primary
      : ratio < 1
        ? COLORS.amber
        : COLORS.danger;

  return (
    <View className={last ? "" : "mb-4"}>
      <View className="flex-row items-baseline justify-between mb-1.5">
        <Text className="font-jk text-ink text-[13.5px]">{label}</Text>
        <Text className="font-jk-med text-muted text-[12px]">
          {unlimited ? `${used}` : `${used} / ${limit}`}
          {unit ? ` ${unit}` : ""}
        </Text>
      </View>

      <View
        style={{ height: 5, borderRadius: 3, backgroundColor: COLORS.surface }}
      >
        <View
          style={{
            height: 5,
            borderRadius: 3,
            // A hairline of fill even at zero, so an empty meter still reads as
            // a meter rather than as a missing one.
            width: unlimited ? "100%" : `${Math.max(2, ratio * 100)}%`,
            backgroundColor: unlimited ? COLORS.surface : fill,
            borderWidth: unlimited ? 1 : 0,
            borderColor: COLORS.line,
          }}
        />
      </View>
    </View>
  );
}
