/**
 * Unit vocabulary.
 *
 * There is no per-unit colour here on purpose. A timetable of six units in six
 * hues reads as a chart rather than a page, and the code itself — CS201 — is
 * already the most recognisable thing about a unit. Weight and spacing carry it.
 */

/** Monday-first, which is how a university timetable is printed. */
export const DAYS = [
  { index: 1, short: "Mon", long: "Monday" },
  { index: 2, short: "Tue", long: "Tuesday" },
  { index: 3, short: "Wed", long: "Wednesday" },
  { index: 4, short: "Thu", long: "Thursday" },
  { index: 5, short: "Fri", long: "Friday" },
  { index: 6, short: "Sat", long: "Saturday" },
  { index: 0, short: "Sun", long: "Sunday" },
];

/** Sort key that puts Sunday at the end of the week rather than the start. */
export function weekOrder(day) {
  return day === 0 ? 7 : day;
}

/**
 * What a student can file under a unit.
 *
 * `note` is text they typed or pasted, and it is the only kind the tutor can
 * actually read back — the rest are attachments waiting on text extraction.
 */
export const MATERIAL_KINDS = [
  { key: "note", label: "Note", hint: "Type or paste text" },
  { key: "pdf", label: "PDF", hint: "Lecture slides, past papers" },
  { key: "image", label: "Image", hint: "Photos of handwritten notes" },
  { key: "link", label: "Link", hint: "An article or a video" },
];

export function kindLabel(key) {
  return MATERIAL_KINDS.find((kind) => kind.key === key)?.label ?? "Note";
}

/** Event kinds shown on Home. */
export const EVENT_KINDS = [
  { key: "assignment", label: "Assignment" },
  { key: "cat", label: "CAT" },
  { key: "exam", label: "Exam" },
  { key: "other", label: "Other" },
];

export function eventKindLabel(key) {
  return EVENT_KINDS.find((kind) => kind.key === key)?.label ?? "Other";
}

export const YEARS = [1, 2, 3, 4, 5, 6];
export const SEMESTERS = [1, 2];
