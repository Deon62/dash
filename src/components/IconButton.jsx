import { Pressable, View } from "react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * A glyph in a soft grey disc.
 *
 * Every screen's top-right control uses this, so they read as one family of
 * affordances rather than as loose icons floating near the heading. The disc
 * is what makes a 17px glyph a 40px target.
 */
export default function IconButton({
  Icon,
  onPress,
  label,
  size = 40,
  tone = "surface",
  /** Colours the glyph alone — used to mark a destructive control. */
  glyphTone = "ink",
  badge = false,
}) {
  const glyph = size >= 40 ? 18 : 16;

  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center active:opacity-60 ${
        tone === "solid" ? "bg-primary" : "bg-surface"
      }`}
    >
      <Icon
        size={glyph}
        color={
          tone === "solid"
            ? COLORS.canvas
            : glyphTone === "danger"
              ? COLORS.danger
              : COLORS.ink
        }
        strokeWidth={1.8}
      />

      {/* Unread marker. Deliberately a dot and not a count — a number invites
          you to clear it, a dot only tells you something arrived. */}
      {badge ? (
        <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
      ) : null}
    </Pressable>
  );
}
