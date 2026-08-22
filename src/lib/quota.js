import { dayKey } from "@/lib/dates";
import {
  PLAN_CONFIGS,
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
 * None of this is security. It runs on the student's device, on data the
 * student owns, and anyone determined to get past it can. It is here to make
 * the product's shape honest and to be the exact logic a server enforces for
 * real once there is one.
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
  if (!subscription.expiresAt) return subscription.tier;

  return new Date(subscription.expiresAt).getTime() > now
    ? subscription.tier
    : SubscriptionTier.TRIAL;
}

export function isExpired(subscription, now = Date.now()) {
  if (!subscription?.expiresAt) return false;
  return new Date(subscription.expiresAt).getTime() <= now;
}

/** Whole days left, floored, never negative. */
export function daysRemaining(subscription, now = Date.now()) {
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

export function aiQueriesLeft(tier, usage) {
  const limit = limitsFor(tier).dailyAiQueries;
  if (limit === UNLIMITED) return null;
  return Math.max(0, limit - rollUsage(usage).aiQueriesToday);
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

/**
 * How many passages an answer may quote.
 *
 * The three citation modes are the honest part of the spec the tutor can
 * actually deliver today: how much of the student's own material an answer is
 * allowed to bring back. Page-exact citation needs the PDF parser that does
 * not exist yet.
 */
export function citationDepth(tier) {
  const mode = limitsFor(tier).sourceCitations;
  if (mode === "deep_summary") return 6;
  if (mode === "exact_page") return 4;
  return 2;
}

/** A fresh subscription of the given tier, starting now. */
export function newSubscription(tier, now = new Date()) {
  const plan = PLAN_CONFIGS[tier] ?? PLAN_CONFIGS[SubscriptionTier.TRIAL];
  const expires = new Date(now);
  expires.setDate(expires.getDate() + plan.durationDays);

  return {
    tier: plan.id,
    startedAt: new Date(now).toISOString(),
    expiresAt: expires.toISOString(),
    /**
     * False until a server has seen the payment. Nothing on the device can
     * confirm a Paystack charge, so this records what the app was told rather
     * than what it knows.
     */
    verified: plan.priceKsh === 0,
  };
}
