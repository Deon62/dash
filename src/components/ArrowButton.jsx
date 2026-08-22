import { Pressable, View } from "react-native";
import { ArrowLeft, ArrowRight } from "lucide-react-native";

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
 * Back points the other way and is drawn in grey: going back is available, but
 * it is not what the screen is asking you to do.
 *
 * Size and radius are inline for the same reason every other disc's are: a
 * class-only circle is one stretchy parent away from a lozenge.
 */
export default function ArrowButton({
  onPress,
  label = "Next",
  direction = "forward",
  hidden = false,
}) {
  const Icon = direction === "back" ? ArrowLeft : ArrowRight;

  // Kept in the layout when there is nowhere to go back to, so the forward
  // arrow does not slide across the footer between the first page and the rest.
  if (hidden) return <View style={{ width: SIZE, height: SIZE }} />;

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
      <Icon
        size={22}
        color={direction === "back" ? COLORS.muted : COLORS.primary}
        strokeWidth={2}
      />
    </Pressable>
  );
}
