import { Text, View } from "react-native";

/**
 * Ranked horizontal bars, one per mode.
 *
 * Replaces the earlier ring: a donut is only honest for part-to-whole at a
 * glance and stops reading past about six segments, so nine modes forced a
 * "top five plus Other" fold — which collided with the mode genuinely called
 * Other. Bars carry any number of categories, compare lengths precisely, and
 * label every row, so nothing has to be rolled up.
 *
 * Colour is decorative identity here, not encoding: each bar is named, so hue
 * never has to carry the distinction.
 */
export default function ModeBars({ data, total }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  if (!data.length) {
    return (
      <Text className="font-jk text-brand-muted text-[13px]">
        No rides in this period.
      </Text>
    );
  }

  return (
    <View className="gap-y-3.5">
      {data.map((d) => {
        const pct = total ? Math.round((d.value / total) * 100) : 0;

        return (
          <View key={d.key} className="flex-row items-center">
            <Text
              numberOfLines={1}
              className="font-jk-semi text-brand-black text-[12px] w-[74px] pr-2"
            >
              {d.label}
            </Text>

            {/* Bars start clear of the labels rather than butting against them. */}
            <View className="flex-1 h-2.5 ml-3 mr-3 justify-center">
              <View
                style={{
                  width: `${Math.max((d.value / max) * 100, 2)}%`,
                  backgroundColor: d.color,
                  // Square at the baseline, rounded at the data end.
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                }}
                className="h-2.5"
              />
            </View>

            <Text
              style={{ fontVariant: ["tabular-nums"] }}
              className="font-jk text-brand-muted text-[11px] w-8 text-right"
            >
              {pct}%
            </Text>
            <Text
              style={{ fontVariant: ["tabular-nums"] }}
              className="font-jk-bold text-brand-black text-[12px] w-7 text-right"
            >
              {d.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
