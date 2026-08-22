import { Pressable } from "react-native";
import { ArrowRight } from "lucide-react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

const SIZE = 56;

/**
 * A blue arrow in a grey disc: "next", with no words.
 *
 * Used where a full-width button would be too much furniture — a carousel that
 * is mostly white space does not need a bar of solid colour across the foot of
 * every panel, and the arrow says the one thing the button was there to say.
 *
 * Size and radius are inline for the same reason every other disc's are: a
 * class-only circle is one stretchy parent away from a lozenge.
 */
export default function ArrowButton({ onPress, label = "Next" }) {
  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
      }}
      className="active:opacity-60"
    >
      <ArrowRight size={22} color={COLORS.primary} strokeWidth={2} />
    </Pressable>
  );
}
