import { Pressable } from "react-native";

import { COLORS, TINTS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * The small round control at the end of a list row.
 *
 * Archive on a document, delete on a deadline, dismiss on a chip: every one of
 * these used to be the same 15px grey glyph in the same transparent circle, so
 * the only thing separating "put this away for next term" from "this is gone"
 * was the silhouette of an icon at the size of a full stop. Two controls with
 * opposite consequences should not have to be read to be told apart.
 *
 * So each one is tinted by what it does, and the tint carries the meaning:
 * amber sets something aside and can be undone, red destroys, blue is ordinary.
 * The ground is a wash rather than a fill — these live inside rows of text, and
 * a saturated disc at this size shouts over the title it belongs to.
 *
 * One component rather than the same fifteen lines in five files, because that
 * is how the grey ones drifted: the same control ended up with three different
 * hit areas and two different press states depending on which screen it was on.
 */

const TONES = {
  /** Reversible. Amber is "held", not "wrong" — nothing has been lost. */
  archive: { color: COLORS.amber, ground: TINTS.amber },
  /** Gone. The only tone in the app that means a row will not come back. */
  danger: { color: COLORS.danger, ground: TINTS.danger },
  /** An ordinary action that happens to live at the end of a row. */
  primary: { color: COLORS.primary, ground: TINTS.primary },
  /** Deliberately quiet — a chevron, or anything that only navigates. */
  muted: { color: COLORS.muted, ground: "transparent" },
};

export default function RowAction({
  Icon,
  label,
  onPress,
  tone = "primary",
  size = 32,
  glyph = 15,
  disabled = false,
}) {
  const { color, ground } = TONES[tone] ?? TONES.primary;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        impact("light");
        onPress?.();
      }}
      disabled={disabled}
      // Generous well past the visible circle. The target is 32px on a screen
      // held one-handed on a bus, and the row it sits in is the thing people
      // hit instead when it is not.
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ground,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        // Neither growing nor shrinking: these sit beside a title that will
        // happily take every pixel in the row if it is allowed to.
        flexGrow: 0,
        flexShrink: 0,
      }}
      className="active:opacity-60"
    >
      <Icon size={glyph} color={color} strokeWidth={1.9} />
    </Pressable>
  );
}
