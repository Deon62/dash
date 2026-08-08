/**
 * Reporting windows for the Stats page.
 *
 * `short` is what the chip shows (space is tight); `heading` titles the page.
 */
export const PERIODS = [
  { key: "7d", short: "7 days", heading: "Last 7 days", days: 7 },
  { key: "1m", short: "1 month", heading: "Last 30 days", days: 30 },
  { key: "3m", short: "3 months", heading: "Last 3 months", days: 90 },
  { key: "6m", short: "6 months", heading: "Last 6 months", days: 180 },
  { key: "1y", short: "1 year", heading: "Last 12 months", days: 365 },
];

export const DEFAULT_PERIOD = "1m";

export function getPeriod(key) {
  return PERIODS.find((p) => p.key === key) ?? PERIODS[1];
}
