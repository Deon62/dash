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
