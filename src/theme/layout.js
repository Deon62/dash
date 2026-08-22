/**
 * Shared chrome measurements.
 *
 * Anything that draws its own scroll container — the Study tab's chat, which
 * cannot use `Screen` because it has a fixed composer — needs to know how tall
 * the bottom bar is, or its last row sits behind it.
 */

/** Height of a tab item — icon over label. */
export const TAB_BAR_HEIGHT = 62;

/** Total vertical space the bar occupies, including the safe area. */
export function getTabBarHeight(insets) {
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 10);
}
