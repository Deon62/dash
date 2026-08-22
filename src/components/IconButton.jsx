import { Pressable, View } from "react-native";

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
        tone === "solid" ? "bg-obsidian" : "bg-surface"
      }`}
    >
      <Icon
        size={glyph}
        color={tone === "solid" ? "#FFFFFF" : "#09090B"}
        strokeWidth={1.8}
      />

      {/* Unread marker. Deliberately a dot and not a count — a number invites
          you to clear it, a dot only tells you something arrived. */}
      {badge ? (
        <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo" />
      ) : null}
    </Pressable>
  );
}
