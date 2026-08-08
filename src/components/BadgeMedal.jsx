import { View } from "react-native";
import Svg, { Circle, Polygon } from "react-native-svg";

/**
 * Custom badge medallion: a rounded hexagon holding a glyph.
 *
 * Built here rather than pulled from an icon set — a bare icon reads as a
 * button, a medallion reads as something earned. Corners are rounded by
 * stroking the polygon in its own fill colour with a round line-join, which
 * avoids hand-writing arc segments for every vertex.
 */
export default function BadgeMedal({
  Icon,
  earned = false,
  progress = 0,
  size = 64,
}) {
  const centre = size / 2;
  const radius = centre - 6;

  // Pointy-top hexagon.
  const points = [-90, -30, 30, 90, 150, 210]
    .map((deg) => {
      const angle = (deg * Math.PI) / 180;
      return `${(centre + radius * Math.cos(angle)).toFixed(2)},${(
        centre +
        radius * Math.sin(angle)
      ).toFixed(2)}`;
    })
    .join(" ");

  const ringRadius = centre - 1.5;
  const circumference = 2 * Math.PI * ringRadius;
  const showProgress = !earned && progress > 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Polygon
          points={points}
          fill={earned ? "#09090B" : "#FFFFFF"}
          stroke={earned ? "#09090B" : "#E5E7EB"}
          strokeWidth={7}
          strokeLinejoin="round"
        />

        {showProgress ? (
          <Circle
            cx={centre}
            cy={centre}
            r={ringRadius}
            stroke="#09090B"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            // Start the arc at twelve o'clock.
            transform={`rotate(-90 ${centre} ${centre})`}
            fill="none"
          />
        ) : null}
      </Svg>

      <View className="absolute inset-0 items-center justify-center">
        <Icon
          size={Math.round(size * 0.36)}
          color={earned ? "#FFFFFF" : "#A1A1AA"}
          strokeWidth={2}
        />
      </View>
    </View>
  );
}
