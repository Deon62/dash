/**
 * Date helpers.
 *
 * Everything in the store is an ISO string so it survives a JSON round-trip
 * through AsyncStorage; these are the only places that turn one back into a
 * Date, which keeps the parsing rules in one file.
 */

const MS_PER_DAY = 86400000;

/** Local midnight — the boundary a student means by "today". */
export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function daysUntil(iso) {
  if (!iso) return null;
  return Math.round((startOfDay(iso) - startOfDay()) / MS_PER_DAY);
}

/** "Today", "Tomorrow", "In 4 days", "3 days late" — never a bare date. */
export function dueLabel(iso) {
  const days = daysUntil(iso);
  if (days === null) return "No date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days <= 6) return `Due in ${days} days`;
  return `Due ${formatDate(iso)}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const today = startOfDay();
  const sameDay = startOfDay(date).getTime() === today.getTime();

  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : formatDate(iso);
}

/** Minutes since midnight for "HH:MM" — used to sort and to find "now". */
export function minutesOf(time) {
  const [hours, minutes] = String(time ?? "").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** "14:30" -> "2:30 PM", using whatever the device prefers. */
export function formatTime(time) {
  const [hours, minutes] = String(time ?? "").split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function nowMinutes() {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

/** Local YYYY-MM-DD. `toISOString` would bucket by UTC and break the streak. */
export function dayKey(value = new Date()) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Local midnight on the 1st of next month — when every allowance refills.
 *
 * Local, like `dayKey`: "the 1st" means the student's 1st. `setDate(1)` before
 * `setMonth` is not tidiness — from the 31st, adding a month lands on a day
 * the next month may not have, and JavaScript rolls that forward into the one
 * after.
 */
export function startOfNextMonth(now = new Date()) {
  const date = startOfDay(now);
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return date;
}

/**
 * When the server says the meters refill, as a local Date.
 *
 * `resets_at` arrives as a plain `YYYY-MM-DD` in the student's own timezone,
 * and `new Date("2026-09-01")` parses that as UTC midnight — which is the 31st,
 * in the evening, for anyone west of Greenwich. Splitting the parts and
 * building a local date is what keeps "refills in 6 days" from reading 5.
 */
export function parseResetDate(value) {
  if (!value) return null;

  const plainDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (plainDay) {
    const [, year, month, day] = plainDay;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Milliseconds until the allowance refills. The server's date wins over ours. */
export function msUntilRefill(resetsAt = null, now = new Date()) {
  const target = parseResetDate(resetsAt) ?? startOfNextMonth(now);
  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * How long until the allowance comes back: "6 days", "1 day", "5h 6m", "20m".
 *
 * Days while there are days left, and hours and minutes only on the last one.
 * Nobody plans revision around "143h", and a seconds digit on a wait this long
 * is a ticking clock nobody asked for — it makes a student watch the number
 * instead of closing the app, and it is wrong by the time they read it anyway.
 *
 * Days are floored: with five and a bit left, "5 days" is true and "6 days" is
 * a promise the calendar does not keep. Minutes are rounded up and never below
 * one, because the last fifty seconds are still a wait and "0m" reads as a bug.
 */
export function untilRefillLabel(resetsAt = null, now = new Date()) {
  const ms = msUntilRefill(resetsAt, now);

  if (ms >= MS_PER_DAY) {
    const days = Math.floor(ms / MS_PER_DAY);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
