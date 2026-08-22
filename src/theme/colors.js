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
  pink: "#EC4899",
  violet: "#7C3AED",
  teal: "#0D9488",
  amber: "#F59E0B",
  danger: "#DC2626",
};

/**
 * What each kind of mark on the calendar is drawn in.
 *
 * One colour per activity, and they are only ever six pixels wide, so they are
 * pulled far apart in hue rather than shaded: red beside orange at that size is
 * one colour. Exam keeps red because red already means "unmissable" everywhere
 * else in the app, and blue stays with classes because classes are the routine
 * the rest is scheduled around.
 */
export const MARK_COLORS = {
  class: COLORS.primary,
  cat: COLORS.pink,
  exam: COLORS.danger,
  assignment: COLORS.violet,
  project: COLORS.teal,
  other: COLORS.amber,
};
