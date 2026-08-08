import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/** Screen gutters either side of the chart, from Screen's px-5. */
const PAGE_GUTTER = 40;

/** Used until a real measurement arrives — never render nothing. */
const FALLBACK_WIDTH = 320;

const HEIGHT = 116;
const SERIES = "#2a78d6"; // categorical slot 1 — single series, so no legend
const PAD_TOP = 10;

/**
 * Change over time, one series.
 *
 * A single series needs no legend — the heading above names what is plotted.
 * Only the final point is direct-labelled; a value on every point reads as
 * clutter, and the exact figures live in the period totals above.
 */
export default function TrendChart({ points, valueLabel }) {
  // Seed from the window so the chart draws on the first frame; onLayout then
  // corrects it. Waiting on onLayout alone leaves a blank gap on mount.
  const { width: screenWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const width = measured || Math.max(screenWidth - PAGE_GUTTER, 0) || FALLBACK_WIDTH;

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const last = points[points.length - 1];

  const plotHeight = HEIGHT - PAD_TOP;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const toX = (i) => i * stepX;
  const toY = (v) => PAD_TOP + plotHeight - (v / max) * plotHeight;

  const line = points.map((p, i) => `${i ? "L" : "M"} ${toX(i)} ${toY(p.value)}`).join(" ");
  const area = `${line} L ${toX(points.length - 1)} ${HEIGHT} L 0 ${HEIGHT} Z`;

  return (
    <View>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.width;
          if (next > 0) setMeasured(next);
        }}
      >
        <Svg width={width} height={HEIGHT}>
            {/* Area is a wash, never a saturated block. */}
            <Path d={area} fill={SERIES} fillOpacity={0.1} />
            <Path
              d={line}
              stroke={SERIES}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            {/* End marker: ≥8px, with a 2px surface ring so it stays legible. */}
            <Circle
              cx={toX(points.length - 1)}
              cy={toY(last.value)}
              r={4}
              fill={SERIES}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
        </Svg>
      </View>

      {/* Baseline: solid hairline, one step off the surface. */}
      <View className="h-px bg-brand-border" />

      <View className="flex-row justify-between mt-2.5">
        <Text className="font-jk-semi text-brand-muted text-[10px]">
          {points[0]?.label}
        </Text>
        <Text className="font-jk-bold text-brand-black text-[10px]">
          {last?.label} · {last?.value} {valueLabel}
        </Text>
      </View>
    </View>
  );
}
