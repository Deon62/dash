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
 * "you have used this month's questions" before spending a round trip finding out,
 * and that keeps working with no connection at all. When the two disagree, the
 * server wins.
 */

const ALLOWED = { ok: true };

function denied(reason, detail, extra) {
  return { ok: false, reason, detail, ...extra };
}

// --- Subscription state ----------------------------------------------------

/**
 * The tier actually in force right now.
 *
 * A subscription that has run out is not the tier it was sold as. It falls
 * back to free — a small allowance rather than nothing, so an unpaid account
 * keeps working in a reduced way instead of locking a student out of their own
 * notes.
 *
 * It used to fall back to the *trial*, which was two units and a fortnight of
 * questions. That was more generous than the plan a new account gets now, and
 * it would have made lapsing an upgrade.
 */
export function activeTier(subscription, now = Date.now()) {
  if (!subscription?.tier) return SubscriptionTier.FREE;

  // `expired` is a tier older servers reported, not one the app sells. It
  // means the paid period ran out, and what applies from then on is free.
  if (subscription.tier === EXPIRED) return SubscriptionTier.FREE;

  // Free carries no end date, and neither does a row that was never finished.
  // Resolving that to the tier itself is right for free and harmless for the
  // rest: the server decides, and it does not trust a missing date either.
  if (!subscription.expiresAt) return subscription.tier;

  return new Date(subscription.expiresAt).getTime() > now
    ? subscription.tier
    : SubscriptionTier.FREE;
}

/**
 * Whether this account has ever held a paid plan.
 *
 * `isExpired` is true for both a lapsed subscription and an account that has
 * simply never bought anything, because it answers one question: is a paid
 * plan in force. The pricing screen needs the other one — "your plan has
 * ended" is wrong, and slightly insulting, on an account that never had one.
 */
export function hasEverPaid(subscription) {
  const nominal = nominalTier(subscription);
  return nominal !== SubscriptionTier.FREE && nominal !== SubscriptionTier.TRIAL;
}

/** What it was sold as, even once it has run out. Used to name what ended. */
export function nominalTier(subscription) {
  return subscription?.nominalTier ?? subscription?.tier ?? SubscriptionTier.FREE;
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
// What the server used to call the free floor. Still arrives from rows written
// before the free plan existed, so it keeps having to mean something.
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

/**
 * The month a counter belongs to, as `YYYY-MM`.
 *
 * Local, off `dayKey`, for the same reason the streak is: a student in Nairobi
 * whose allowance refilled at 3am on the 1st because the server was counting
 * in UTC has been given a month that does not match their calendar.
 */
export function monthKey(value = new Date()) {
  return dayKey(value).slice(0, 7);
}

/**
 * Rolls counters that have moved into a new period.
 *
 * Called before every read as well as every write, because a student who
 * leaves the app open over the turn of the month must wake up with a fresh
 * allowance without having to restart it.
 */
export function rollUsage(usage, now = new Date()) {
  const month = monthKey(now);
  // Everything meters on the same clock now, so one comparison decides the lot.
  const current = usage.month === month;

  return {
    ...usage,
    month,
    // `?? 0` throughout, because an install that predates a field has no value
    // for it. Reading `undefined` here would compare as NaN and quietly allow
    // past the ceiling, which is the one thing these counters exist to stop.
    aiQueriesThisMonth: current ? usage.aiQueriesThisMonth ?? 0 : 0,
    quizzesThisMonth: current ? usage.quizzesThisMonth ?? 0 : 0,
    ocrPagesThisMonth: current ? usage.ocrPagesThisMonth ?? 0 : 0,
    // Lifetime counters never roll — that is what makes them lifetime.
    quizzesEver: usage.quizzesEver ?? 0,
    aiQueriesEver: usage.aiQueriesEver ?? 0,
  };
}

// --- Checks ----------------------------------------------------------------

/**
 * Units are not something a plan sells, and this refusal must not imply they are.
 *
 * It takes no tier for that reason — the cap is the same on every plan, free
 * included, and no payment lifts it. The wording carries the same weight: it
 * used to read "Focus covers 4 course units", which named a plan and so read as
 * a price tag on the one thing here that has none. A student who acts on that
 * arrives at the paywall to buy something that is not for sale.
 *
 * `upgradable: false` is what stops the sheet offering plans at all.
 */
export function canAddUnit(unitCount) {
  const cap = unitCap();
  if (unitCount < cap) return ALLOWED;

  return denied(
    "units",
    `You can follow up to ${cap} course units at once, on every plan. ` +
      "Removing one you have finished frees a slot — along with everything filed under it.",
    { upgradable: false },
  );
}

/**
 * Two ceilings, and they mean different things to whoever hits them.
 *
 * The monthly one is a rate: it comes back on the 1st. The lifetime one is the
 * end of the free plan, and the message has to say so — sending someone away
 * to wait for a refill that is never coming is worse than telling them it is
 * over.
 *
 * The lifetime one is checked first for that reason. Once it is spent, "you
 * have used this month's thirty" is technically true and completely misleading.
 */
export function canAskAi(tier, usage) {
  const limits = limitsFor(tier);
  const rolled = rollUsage(usage);

  const ceiling = limits.lifetimeAiQueries;
  if (ceiling !== UNLIMITED && (rolled.aiQueriesEver ?? 0) >= ceiling) {
    return denied(
      "ai",
      `You have used all ${ceiling} questions the free plan includes. ` +
        "A paid plan carries on from here.",
    );
  }

  const limit = limits.monthlyAiQueries;
  if (limit === UNLIMITED) return ALLOWED;

  if (rolled.aiQueriesThisMonth < limit) return ALLOWED;

  // `refills` rather than a countdown baked into the sentence: the refusal is
  // read on a sheet that may sit open for a while, and a wait that was written
  // once is wrong by the time anyone acts on it. The screen ticks it.
  return denied("ai", `You have used this month's ${limit} AI questions.`, {
    refills: true,
  });
}

export function canStartQuiz(tier, usage) {
  const { count, interval } = limitsFor(tier).quizzesPerInterval;
  if (count === UNLIMITED || interval === "unlimited") return ALLOWED;

  const rolled = rollUsage(usage);
  const used = interval === "monthly" ? rolled.quizzesThisMonth : rolled.quizzesEver;
  if (used < count) return ALLOWED;

  return denied(
    "quiz",
    interval === "monthly"
      ? `You have used this month's ${count} quizzes.`
      : `${planName(tier)} includes ${count} quizzes in total.`,
    interval === "monthly" ? { refills: true } : undefined,
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
 * `monthlyPdfPages` are carried in the config and shown on the pricing card but
 * cannot be enforced until a parser exists. Pretending to enforce them would be
 * worse than the gap — it would let a 400-page file through while claiming it
 * had been checked.
 *
 * The server counts the pages it actually extracted, which is why the page
 * meters on the usage screen only ever come from it: the device has no number
 * of its own to fall back to.
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

/**
 * Whether this account may scan a page of handwriting right now.
 *
 * Asked **before the camera opens**, never after. The server refuses an
 * over-allowance scan by marking it `skipped`, which is correct but is a
 * miserable way to find out: by then the student has framed a page, taken a
 * photo and paid for the upload.
 *
 * `meter` is `serverUsage.ocrPages` where it has arrived, and it wins. It is
 * the count the server will actually refuse against, and it knows about scans
 * taken on another handset — which the device's own tally, by definition, does
 * not. The local counters are the fallback for a first render and for no
 * connection, which is the whole reason they still exist.
 *
 * A `limit` of zero means the plan does not include scanning at all. That is a
 * different refusal from having spent the allowance and needs a different way
 * out, so it is answered first and carries no refill promise.
 */
export function canUseOcr(tier, usage, meter = null) {
  const { allowOcrScans, monthlyOcrPageLimit } = limitsFor(tier);

  const unlimited = Boolean(meter?.unlimited);
  const limit = meter && !unlimited ? meter.limit : monthlyOcrPageLimit;
  const allowed = unlimited || (meter ? limit > 0 : allowOcrScans);

  if (!allowed) {
    return denied("ocr", "Scanning handwritten notes is a Synapse feature.");
  }

  if (unlimited) return ALLOWED;

  const used = meter ? meter.used : rollUsage(usage).ocrPagesThisMonth;
  if (used < limit) return ALLOWED;

  return denied("ocr", `You have scanned this month's ${limit} pages.`, {
    refills: true,
    // Already on a scanning plan and out of pages: there is nothing to buy that
    // fixes this, so the sheet must not offer plans. The allowance comes back
    // on the 1st and the countdown above it is the honest answer.
    upgradable: false,
    resetsAt: meter?.resetsAt ?? null,
  });
}

/** Whether the plan includes scanning at all, regardless of what is left. */
export function scanningIncluded(tier, meter = null) {
  if (meter) return Boolean(meter.unlimited) || meter.limit > 0;
  return limitsFor(tier).allowOcrScans;
}

/** Timetable alerts are off on free, which only supports manual entry. */
export function canUseAlerts(tier) {
  return limitsFor(tier).timetableMode !== "manual";
}
