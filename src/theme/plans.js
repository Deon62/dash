/**
 * Subscription tiers and what each one allows.
 *
 * This file is the single source of truth for every limit in the app. Nothing
 * else hard-codes a number: the screens read from here, `src/lib/quota.js`
 * decides against it, and when a real backend arrives it should serve exactly
 * this shape so the two cannot drift.
 *
 * Two of the three tiers are sold. `TRIAL` is not a product — it is the state
 * every new account starts in, for seven days, whichever plan they eventually
 * pick.
 */

export const SubscriptionTier = {
  TRIAL: "trial",
  STANDARD: "standard",
  PRO: "pro",
};

/**
 * `-1` on a limit means unlimited.
 *
 * `maxCourseUnits` is the exception the spec calls out: unlimited there is
 * still capped, because the tutor's retrieval quality falls off long before a
 * student has fifty units filed and an "unlimited" that degrades the product
 * is worse than a stated number.
 */
export const UNLIMITED = -1;
export const UNIT_HARD_CAP = 10;

export const PLAN_CONFIGS = {
  [SubscriptionTier.TRIAL]: {
    id: SubscriptionTier.TRIAL,
    name: "7-Day Free Trial",
    priceKsh: 0,
    durationDays: 7,
    limits: {
      maxCourseUnits: 2,
      totalPdfPagesPool: 100,
      maxSingleFileSizeMb: 10,
      maxSingleFilePages: 30,
      dailyAiQueries: 15,
      quizzesPerInterval: { count: 2, interval: "lifetime", maxQuestions: 5 },
      timetableMode: "manual",
      sourceCitations: "basic",
      allowOcrScans: false,
      monthlyOcrPageLimit: 0,
    },
  },
  [SubscriptionTier.STANDARD]: {
    id: SubscriptionTier.STANDARD,
    name: "Standard Plan",
    priceKsh: 150,
    durationDays: 30,
    limits: {
      maxCourseUnits: 4,
      totalPdfPagesPool: 400,
      maxSingleFileSizeMb: 25,
      maxSingleFilePages: 100,
      dailyAiQueries: 40,
      quizzesPerInterval: { count: 5, interval: "weekly", maxQuestions: 10 },
      timetableMode: "alerts",
      sourceCitations: "exact_page",
      allowOcrScans: false,
      monthlyOcrPageLimit: 0,
    },
  },
  [SubscriptionTier.PRO]: {
    id: SubscriptionTier.PRO,
    name: "Pro Scholar",
    priceKsh: 350,
    durationDays: 30,
    limits: {
      maxCourseUnits: 10,
      totalPdfPagesPool: 1500,
      maxSingleFileSizeMb: 50,
      maxSingleFilePages: 300,
      dailyAiQueries: 120,
      quizzesPerInterval: { count: UNLIMITED, interval: "unlimited", maxQuestions: 20 },
      timetableMode: "ai_sync",
      sourceCitations: "deep_summary",
      allowOcrScans: true,
      monthlyOcrPageLimit: 30,
    },
  },
};

/**
 * What the student is shown and sold.
 *
 * The tier ids stay `standard` and `pro` because that is what the config, the
 * store and any future server speak; the names are what a student reads.
 */
export const PLAN_CARDS = [
  {
    tier: SubscriptionTier.STANDARD,
    name: "Focus",
    tagline: "Enough for a normal semester",
    checkoutUrl: "https://paystack.shop/pay/cnt7kf6l-7",
  },
  {
    tier: SubscriptionTier.PRO,
    name: "Synapse",
    tagline: "For a full course load and finals",
    checkoutUrl: "https://paystack.shop/pay/a-tbik1kof",
  },
];

export function planFor(tier) {
  return PLAN_CONFIGS[tier] ?? PLAN_CONFIGS[SubscriptionTier.TRIAL];
}

export function limitsFor(tier) {
  return planFor(tier).limits;
}

export function planName(tier) {
  return PLAN_CARDS.find((card) => card.tier === tier)?.name ?? planFor(tier).name;
}

/** Resolves `maxCourseUnits`, honouring the hard cap that unlimited carries. */
export function unitCap(tier) {
  const limit = limitsFor(tier).maxCourseUnits;
  return limit === UNLIMITED ? UNIT_HARD_CAP : Math.min(limit, UNIT_HARD_CAP);
}

// --- Human-readable feature lines ------------------------------------------

const TIMETABLE_COPY = {
  manual: "Timetable you enter yourself",
  alerts: "Timetable with deadline and class alerts",
  ai_sync: "AI timetable sync from your documents",
};

const CITATION_COPY = {
  basic: "Answers cite the note they came from",
  exact_page: "Answers cite the exact page",
  deep_summary: "Deep summaries with page-level citations",
};

function count(value, one, many = `${one}s`) {
  return `${value} ${value === 1 ? one : many}`;
}

/**
 * Every limit in a plan, spelled out.
 *
 * Generated from the config rather than written per card, so a number can
 * never be changed in one place and stay stale on the pricing screen — the
 * classic way a paid tier ends up advertising a limit it does not have.
 */
export function planFeatures(tier) {
  const limits = limitsFor(tier);
  const quiz = limits.quizzesPerInterval;

  const quizLine =
    quiz.count === UNLIMITED
      ? `Unlimited quizzes, up to ${count(quiz.maxQuestions, "question")}`
      : quiz.interval === "weekly"
        ? `${count(quiz.count, "quiz", "quizzes")} a week, up to ${count(quiz.maxQuestions, "question")}`
        : `${count(quiz.count, "quiz", "quizzes")} in total, up to ${count(quiz.maxQuestions, "question")}`;

  return [
    // Stated on both cards rather than once above them: it is part of what
    // each plan is, and a student comparing two columns should not have to
    // look somewhere else to learn it applies to the one they are reading.
    { text: `${PLAN_CONFIGS[SubscriptionTier.TRIAL].durationDays}-day free trial`, available: true },
    { text: count(unitCap(tier), "course unit"), available: true },
    { text: `${limits.totalPdfPagesPool} PDF pages of storage`, available: true },
    {
      text: `Up to ${limits.maxSingleFileSizeMb}MB and ${limits.maxSingleFilePages} pages per file`,
      available: true,
    },
    { text: `${count(limits.dailyAiQueries, "AI question")} a day`, available: true },
    { text: quizLine, available: true },
    { text: TIMETABLE_COPY[limits.timetableMode], available: true },
    { text: CITATION_COPY[limits.sourceCitations], available: true },
    {
      text: limits.allowOcrScans
        ? `Scan handwritten notes, ${limits.monthlyOcrPageLimit} pages a month`
        : "Scan handwritten notes",
      available: limits.allowOcrScans,
    },
  ];
}
