/**
 * The palette, as values.
 *
 * Tailwind owns these too, but a class only works where NativeWind can apply
 * one. Anything drawn with a prop — an icon's `color`, a `Switch` track, a
 * calendar dot, a style object that would otherwise beat the class — reads
 * them from here so there is still exactly one place a colour is defined.
 */
export const COLORS = {
  canvas: "#FFFFFF",
  surface: "#F4F4F5",
  line: "#E4E4E7",
  ink: "#09090B",
  muted: "#71717A",
  primary: "#007FFA",
  warn: "#F59E0B",
  danger: "#DC2626",
};

/**
 * What each kind of mark on the calendar is drawn in.
 *
 * Three meanings, three colours, and no more: classes are the routine, a CAT
 * is a warning, an exam is the one you cannot miss. Everything else shares the
 * neutral so the three that matter stay distinguishable at four pixels wide.
 */
export const MARK_COLORS = {
  class: COLORS.primary,
  cat: COLORS.warn,
  exam: COLORS.danger,
  assignment: COLORS.muted,
  other: COLORS.muted,
};
