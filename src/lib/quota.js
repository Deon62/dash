import { dayKey } from "@/lib/dates";
import {
  SubscriptionTier,
  UNLIMITED,
  limitsFor,
  planName,
  unitCap,
} from "@/theme/plans";

/**
 * Every "are you allowed to do this" decision in the app.
 *
 * Pure functions over a state snapshot, deliberately: enforcement that lives
 * inside components ends up half-applied — one screen checks, another forgets,
 * and the limit is whatever the last person to touch a file remembered. These
 * take the subscription and the usage counters and return a verdict, so the
 * screens only have to decide what to say about it.
 *
 * None of this is enforcement. The server meters the same allowances from the
 * same config and refuses for real; this is the copy that lets a screen say
 * "you have used today's questions" before spending a round trip finding out,
 * and that keeps working with no connection at all. When the two disagree, the
 * server wins.
 */

const ALLOWED = { ok: true };

function denied(reason, detail) {
  return { ok: false, reason, detail };
}

// --- Subscription state ----------------------------------------------------

/**
 * The tier actually in force right now.
 *
 * An expired subscription is not the tier it was sold as. It falls back to the
 * trial's limits rather than to nothing, so an unpaid account keeps working in
 * a reduced way instead of locking a student out of their own notes.
 */
export function activeTier(subscription, now = Date.now()) {
  if (!subscription?.tier) return SubscriptionTier.TRIAL;

  // `expired` is a tier the server reports, not one the app sells. It means
  // the paid period ran out, and the limits that apply from then on are the
  // trial's — an unpaid account keeps working in a reduced way rather than
  // locking a student out of their own notes.
  if (subscription.tier === EXPIRED) return SubscriptionTier.TRIAL;
  if (!subscription.expiresAt) return subscription.tier;

  return new Date(subscription.expiresAt).getTime() > now
    ? subscription.tier
    : SubscriptionTier.TRIAL;
}

/** What it was sold as, even once it has run out. Used to name what ended. */
export function nominalTier(subscription) {
  return subscription?.nominalTier ?? subscription?.tier ?? SubscriptionTier.TRIAL;
}

export function isExpired(subscription, now = Date.now()) {
  if (!subscription) return false;
  // The server's own verdict first: it knows about a plan cancelled or a
  // payment reversed, neither of which shows up in an expiry date.
  if (subscription.isExpired !== undefined) return Boolean(subscription.isExpired);
  if (subscription.tier === EXPIRED) return true;
  if (!subscription.expiresAt) return false;

  return new Date(subscription.expiresAt).getTime() <= now;
}

/** The server's word for a plan that has run out. Never sold, only reported. */
const EXPIRED = "expired";

/** Whole days left, floored, never negative. */
export function daysRemaining(subscription, now = Date.now()) {
  // The server counts them too, and its clock is the one the plan ends on.
  if (typeof subscription?.daysRemaining === "number") {
    return Math.max(0, subscription.daysRemaining);
  }
  if (!subscription?.expiresAt) return null;
  const ms = new Date(subscription.expiresAt).getTime() - now;
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Start of the ISO week (Monday), as a day key. Used for weekly quotas. */
export function weekKey(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  // getDay() is Sunday-first; shift so Monday starts the week.
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dayKey(date);
}

/**
 * Rolls counters that have moved into a new period.
 *
 * Called before every read as well as every write, because a student who
 * leaves the app open overnight must wake up with a fresh daily allowance
 * without having to restart it.
 */
export function rollUsage(usage, now = new Date()) {
  const today = dayKey(now);
  const week = weekKey(now);
  const month = today.slice(0, 7);

  return {
    ...usage,
    day: today,
    aiQueriesToday: usage.day === today ? usage.aiQueriesToday : 0,
    week,
    quizzesThisWeek: usage.week === week ? usage.quizzesThisWeek : 0,
    month,
    ocrPagesThisMonth: usage.month === month ? usage.ocrPagesThisMonth : 0,
    // Lifetime counters never roll — that is what makes them lifetime.
    quizzesEver: usage.quizzesEver ?? 0,
  };
}

// --- Checks ----------------------------------------------------------------

export function canAddUnit(tier, unitCount) {
  const cap = unitCap(tier);
  if (unitCount < cap) return ALLOWED;

  return denied(
    "units",
    `${planName(tier)} covers ${cap} course ${cap === 1 ? "unit" : "units"}.`
  );
}

export function canAskAi(tier, usage) {
  const limit = limitsFor(tier).dailyAiQueries;
  if (limit === UNLIMITED) return ALLOWED;

  const used = rollUsage(usage).aiQueriesToday;
  if (used < limit) return ALLOWED;

  return denied("ai", `You have used today's ${limit} AI questions.`);
}

export function canStartQuiz(tier, usage) {
  const { count, interval } = limitsFor(tier).quizzesPerInterval;
  if (count === UNLIMITED || interval === "unlimited") return ALLOWED;

  const rolled = rollUsage(usage);
  const used = interval === "weekly" ? rolled.quizzesThisWeek : rolled.quizzesEver;
  if (used < count) return ALLOWED;

  return denied(
    "quiz",
    interval === "weekly"
      ? `You have used this week's ${count} quizzes.`
      : `${planName(tier)} includes ${count} quizzes in total.`
  );
}

/** How many questions a quiz on this tier may contain. */
export function quizSize(tier) {
  return limitsFor(tier).quizzesPerInterval.maxQuestions;
}

/**
 * Whether a picked file may be filed.
 *
 * Size is checked because the picker reports it. Page count is not: nothing in
 * the app can read a PDF's page count yet, so `maxSingleFilePages` and
 * `totalPdfPagesPool` are carried in the config and shown on the pricing card
 * but cannot be enforced until a parser exists. Pretending to enforce them
 * would be worse than the gap — it would let a 400-page file through while
 * claiming it had been checked.
 */
export function canAttachFile(tier, sizeBytes) {
  const limitMb = limitsFor(tier).maxSingleFileSizeMb;
  if (!sizeBytes) return ALLOWED;

  const sizeMb = sizeBytes / (1024 * 1024);
  if (sizeMb <= limitMb) return ALLOWED;

  return denied(
    "file",
    `${planName(tier)} accepts files up to ${limitMb}MB. That one is ${sizeMb.toFixed(1)}MB.`
  );
}

export function canUseOcr(tier, usage) {
  const { allowOcrScans, monthlyOcrPageLimit } = limitsFor(tier);
  if (!allowOcrScans) return denied("ocr", "Scanning is a Synapse feature.");

  const used = rollUsage(usage).ocrPagesThisMonth;
  if (used < monthlyOcrPageLimit) return ALLOWED;

  return denied("ocr", `You have scanned this month's ${monthlyOcrPageLimit} pages.`);
}

/** Timetable alerts are off on the trial, which only supports manual entry. */
export function canUseAlerts(tier) {
  return limitsFor(tier).timetableMode !== "manual";
}
