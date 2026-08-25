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
  { key: "pdf", label: "PDF", hint: "Slides, papers, past exams" },
  { key: "image", label: "Image", hint: "Photos of handwritten notes" },
  { key: "link", label: "Link", hint: "An article or a video" },
];

export function kindLabel(key) {
  return MATERIAL_KINDS.find((kind) => kind.key === key)?.label ?? "Note";
}

/**
 * What a dated thing can be.
 *
 * `other` is deliberately last and deliberately open: a student's semester has
 * things in it no fixed list will cover — a presentation, a lab sign-off, a
 * supervisor meeting — and the alternative to naming it themselves is filing
 * it as an assignment it is not.
 */
export const EVENT_KINDS = [
  { key: "assignment", label: "Assignment" },
  { key: "cat", label: "CAT" },
  { key: "exam", label: "Exam" },
  { key: "project", label: "Project" },
  { key: "other", label: "Other", open: true },
];

export function eventKindLabel(key) {
  return EVENT_KINDS.find((kind) => kind.key === key)?.label ?? "Other";
}

/**
 * What to call one event.
 *
 * An `other` event carries whatever the student typed; everything else uses
 * its kind's name. Falling back to "Other" rather than an empty string keeps
 * the row's meta line from ending in a stray separator.
 */
export function eventLabel(event) {
  if (event?.kind === "other" && event.label) return event.label;
  return eventKindLabel(event?.kind);
}

export const YEARS = [1, 2, 3, 4, 5, 6];
/**
 * Three, not two.
 *
 * Two covers a conventional undergraduate year, but plenty of postgraduate
 * programmes run on trimesters — and a student whose semester is not on the
 * list has to file their work under one they are not in.
 */
export const SEMESTERS = [1, 2, 3];
