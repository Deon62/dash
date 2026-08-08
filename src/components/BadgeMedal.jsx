import { View } from "react-native";
import Svg, { Circle, Polygon } from "react-native-svg";

/**
 * Relative luminance (WCAG). Used to choose the glyph colour inside a coloured
 * medallion — a white glyph is illegible on the lighter hues (yellow, aqua), so
 * the fill decides rather than an assumption.
 */
function luminance(hex) {
  const channel = (v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const INK = "#09090B";

function glyphOn(fill) {
  // Contrast against white vs against ink; take the better of the two.
  const l = luminance(fill);
  const vsWhite = 1.05 / (l + 0.05);
  const vsInk = (l + 0.05) / 0.05;
  return vsWhite >= vsInk ? "#FFFFFF" : INK;
}

/**
 * Custom badge medallion: a rounded hexagon holding a glyph.
 *
 * Built here rather than pulled from an icon set — a bare icon reads as a
 * button, a medallion reads as something earned. Corners are rounded by
 * stroking the polygon in its own fill colour with a round line-join, which
 * avoids hand-writing arc segments for every vertex.
 *
 * Earned badges wear their colour as a fill; locked ones stay white with the
 * colour showing only in the progress ring, so the two states never read alike.
 */
export default function BadgeMedal({
  Icon,
  color = INK,
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
          fill={earned ? color : "#FFFFFF"}
          stroke={earned ? color : "#E5E7EB"}
          strokeWidth={7}
          strokeLinejoin="round"
        />

        {showProgress ? (
          <Circle
            cx={centre}
            cy={centre}
            r={ringRadius}
            stroke={color}
            strokeWidth={2.5}
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
          color={earned ? glyphOn(color) : "#A1A1AA"}
          strokeWidth={2}
        />
      </View>
    </View>
  );
}
