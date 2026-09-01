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
  /**
   * A lighter rule, for long runs of list separators.
   *
   * `line` is right where a border has to state an edge — a card, a field. Down
   * a list of eight links it stacks up and the page starts to read as a table,
   * so those get this instead: present from across the room, invisible when you
   * are reading a row.
   */
  hairline: "#F1F1F3",
  ink: "#09090B",
  muted: "#71717A",
  /**
   * Text that is still there but no longer live: a date already past, a
   * placeholder waiting to be typed over.
   *
   * A step lighter than `muted`, which is for text you are meant to read. This
   * is for text you are meant to skip.
   */
  faint: "#A1A1AA",
  primary: "#007FFA",
  pink: "#EC4899",
  violet: "#7C3AED",
  teal: "#0D9488",
  amber: "#F59E0B",
  /**
   * The streak flame, and the tutor's thinking label.
   *
   * Both are the app speaking rather than reporting: one says a habit is
   * alive, the other that work is happening. It is the only warm colour in a
   * palette that is otherwise blue and grey, so it carries either without
   * needing size or a fill behind it. Nothing else should take it.
   */
  flame: "#F97316",
  /**
   * Archiving: warm, nearly red, and deliberately not `danger`.
   *
   * It needs its own value because the two actions sit in the same place and
   * mean opposite things. `danger` is for a row that does not come back, and
   * archiving is the reversible one — but it is still the destructive-feeling
   * control on the card, so amber read as too casual for it.
   *
   * Not `flame`, which is spoken for: that one belongs to the streak and the
   * tutor's thinking label, and is the only warm colour in the app that means
   * something on its own.
   */
  ember: "#E4552E",
  danger: "#DC2626",
};

/**
 * The soft ground a coloured glyph sits on.
 *
 * Every small action in a list used to be the same grey glyph in the same
 * transparent circle: archive, delete, dismiss, all identical until you read
 * the shape of a 15px icon. Colour is what tells them apart before anybody
 * reads anything — and it is the difference between a control that puts
 * something aside and one that destroys it, which is exactly the pair worth
 * separating at a glance.
 *
 * Low alpha rather than a second set of hex values. A tint mixed against the
 * page stays right on the white canvas and on the grey wells both, where a
 * fixed light shade of each colour only matches one of them — and there would
 * be five more constants here that have to be re-picked whenever a colour
 * moves.
 *
 * They are deliberately faint. These sit inside rows of text, and a saturated
 * fill at this size reads as an alert rather than as a button.
 */
export const TINTS = {
  primary: "rgba(0, 127, 250, 0.10)",
  danger: "rgba(220, 38, 38, 0.09)",
  amber: "rgba(245, 158, 11, 0.13)",
  teal: "rgba(13, 148, 136, 0.10)",
  violet: "rgba(124, 58, 237, 0.10)",
  muted: "rgba(113, 113, 122, 0.10)",
};

/**
 * A note on where these are and are not used.
 *
 * Row actions do **not** take a tint any more — their disc stays the ordinary
 * grey `surface` and the colour is carried by the glyph alone. A coloured disc
 * turned a 32px control into the loudest thing in a row of text, and put the
 * emphasis on archiving a note rather than on the note. Colour still separates
 * the actions; it just does it at the size of an icon instead of a button.
 */

/**
 * What each kind of mark on the calendar is drawn in.
 *
 * One colour per activity, and they are only ever six pixels wide, so they are
 * pulled far apart in hue rather than shaded: red beside orange at that size is
 * one colour. Exam keeps red because red already means "unmissable" everywhere
 * else in the app, and blue stays with sessions because sessions are the routine
 * the rest is scheduled around.
 */
export const MARK_COLORS = {
  session: COLORS.primary,
  cat: COLORS.pink,
  exam: COLORS.danger,
  assignment: COLORS.violet,
  project: COLORS.teal,
  other: COLORS.amber,
};
