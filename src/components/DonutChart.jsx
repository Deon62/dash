import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

/**
 * Part-to-whole ring. Segments are separated by a gap in the surface colour
 * rather than by strokes — a border around a mark adds ink that isn't data.
 *
 * Capped at a handful of segments by design; a ring stops being readable past
 * about six, and close values belong in the bar chart beside it.
 */
export default function DonutChart({
  segments,
  size = 208,
  thickness = 20,
  gap = 4,
  children,
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;
  const arcs = total
    ? segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const full = (s.value / total) * circumference;
          // Never let the gap eat a thin segment entirely.
          const length = Math.max(full - gap, 1.5);
          const arc = { ...s, length, offset };
          offset += full;
          return arc;
        })
    : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Rotate so the ring starts at twelve o'clock. */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {total === 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#EFEFF2"
              strokeWidth={thickness}
              fill="none"
            />
          ) : (
            arcs.map((arc) => (
              <Circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={arc.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={-arc.offset}
                fill="none"
              />
            ))
          )}
        </G>
      </Svg>

      <View className="absolute inset-0 items-center justify-center">
        {children}
      </View>
    </View>
  );
}
