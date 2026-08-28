import { dayKey } from "@/lib/dates";

/**
 * The streak as it stands right now, rather than as it stood when it was last
 * written down.
 *
 * `study.streakDays` is only ever changed by `recordStudy`, which runs when a
 * question is asked. Nothing runs when a day passes without one. So a student
 * who revised Monday and Tuesday and then stopped still has `streakDays: 2`
 * sitting in storage on Friday, and the badge keeps showing a flame for a
 * streak that died on Wednesday.
 *
 * The date is the missing input. A streak is alive only if its last day was
 * today or yesterday: yesterday still counts because the day is not over, and
 * ending it at midnight would punish someone who revises in the evening for
 * opening the app the next morning.
 */
export function liveStreak(study) {
  const days = study?.streakDays ?? 0;
  const last = study?.lastStudyDay;

  if (!days || !last) return 0;

  return last === dayKey() || last === dayKey(Date.now() - 86400000) ? days : 0;
}

/**
 * Lines for the streak screen, one of each kind per day.
 *
 * Three moods, because the screen is answering three different questions.
 * Nothing here scolds: a student who has not revised today already knows, and
 * an app that says so sharply is one they stop opening.
 */

/** No streak running, and none today. The ask has to be small enough to say yes to. */
const STARTERS = [
  "One question today and the streak begins.",
  "Everything starts at one. Ask something.",
  "A blank board is just an unstarted one.",
  "Pick the easiest thing you know. It still counts.",
  "One question. That is the entire ask.",
  "Day one is the only one you have to decide on.",
  "Open a unit and ask it anything.",
  "Nothing to lose today. Only a day to gain.",
];

/** A live streak, not yet fed today. */
const NUDGES = [
  "The flame is waiting on you.",
  "Today is still blank. Go colour it in.",
  "One question keeps it burning.",
  "Five minutes now beats an hour on Sunday.",
  "Your notes have been waiting patiently.",
  "The streak does not defend itself.",
  "Future you is watching. Be kind to them.",
  "Small today beats heroic never.",
  "Start with the easy one. It counts the same.",
  "Nothing revises itself, sadly.",
];

/** Today is done. Say so warmly and get out of the way. */
const CHEERS = [
  "Today is on the board.",
  "That is today handled.",
  "The flame is fed. Nice work.",
  "Another one in the bank.",
  "You showed up. That is the hard part.",
  "Streak intact. Well played.",
  "One more day than yesterday.",
  "Logged. Go and enjoy your evening.",
  "Done and dusted. Rest easy.",
  "Good. Now go and do something else.",
];

/**
 * A stable index for a given day.
 *
 * Deliberately not `Math.random()`: the streak screen re-renders whenever
 * anything in the store moves, and a random line would change under the
 * student mid-read. Hashing the day key means one line per day, the same one
 * all day, and a different one tomorrow.
 */
function dayIndex(key, length) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return hash % length;
}

/**
 * What to say under the number.
 *
 * `revisedToday` comes from the earned days rather than the count, so the line
 * agrees with the ticks on the week row even when the count disagrees with
 * both — which is exactly what happens the morning after a streak breaks.
 */
export function streakLine({ current, revisedToday, today = dayKey() }) {
  const set = revisedToday ? CHEERS : current > 0 ? NUDGES : STARTERS;
  return set[dayIndex(today, set.length)];
}
