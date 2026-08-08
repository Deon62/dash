/**
 * Shared chrome measurements.
 *
 * The trip sheet has to know how tall the bottom bar is: its collapsed snap
 * point must clear the bar, otherwise the peek card sits behind it.
 */

/** Height of a tab item — icon over label. */
export const TAB_BAR_HEIGHT = 62;

/** Total vertical space the bar occupies, including the safe area. */
export function getTabBarHeight(insets) {
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 10);
}

/**
 * Height of the sheet's visible card content, below the drag handle: one row
 * holding the headline and the action button, plus slack.
 */
export const SHEET_PEEK_HEIGHT = 84;

/** gorhom renders a fixed-height handle above sheet content. */
export const SHEET_HANDLE_HEIGHT = 24;
