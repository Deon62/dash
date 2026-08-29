/**
 * How long a note can be and still work as a flashcard.
 *
 * Not a cap on notes. Nothing refuses a long one or shortens it: it is filed
 * whole, synced whole, and the tutor reads all of it. Typing out a lecture is
 * a good reason to use this app, and the limit that stopped you would be
 * removing the reason.
 *
 * What the number decides is the deck. A card is read at a glance, and the
 * deck used to make one out of every note by cutting it to its first sentence
 * — so a student who had written six lines turned one over, found one of them,
 * and had nothing telling them the rest still existed. It looks like the app
 * lost the note. A card now shows its note whole or there is no card, and this
 * is the line between the two.
 *
 * 120 words is roughly what fills a card without the page having to scroll to
 * finish one: a definition, a worked step, a paragraph worth recalling. Longer
 * material is not worse, it is just a different thing to do with material —
 * Ask, where the whole document is in play.
 *
 * Read by `buildFlashcards` in `src/lib/tutor.js`, which builds the deck, and
 * by `AddKnowledge`, which says where the line is while a note is being
 * written rather than leaving it to be discovered by absence.
 */
export const NOTE_WORD_LIMIT = 120;

/** Words as a person counts them: runs of non-space, punctuation included. */
export function countWords(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** True where a note is short enough to be shown whole on a card. */
export function withinNoteLimit(text, limit = NOTE_WORD_LIMIT) {
  return countWords(text) <= limit;
}
