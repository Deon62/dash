import { Pressable } from "react-native";

import { COLORS } from "@/theme/colors";
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
 * So the **glyph** is coloured by what it does and the disc behind it stays the
 * ordinary grey: a warm near-red sets something aside and can be undone, true
 * red destroys, blue is ordinary. Colouring the disc instead was too loud —
 * these live inside rows of text, and a tinted circle made a 32px control the
 * brightest thing on the card, so the eye went to archiving a note rather than
 * to the note.
 *
 * One component rather than the same fifteen lines in five files, because that
 * is how the grey ones drifted: the same control ended up with three different
 * hit areas and two different press states depending on which screen it was on.
 */

const TONES = {
  /** Reversible, but not casual. See `ember` in the palette. */
  archive: COLORS.ember,
  /** Gone. The only tone in the app that means a row will not come back. */
  danger: COLORS.danger,
  /** An ordinary action that happens to live at the end of a row. */
  primary: COLORS.primary,
  /** Deliberately quiet — a chevron, or anything that only navigates. */
  muted: COLORS.muted,
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
  const color = TONES[tone] ?? TONES.primary;

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
        backgroundColor: COLORS.surface,
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
