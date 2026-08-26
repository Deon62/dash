/**
 * Subscription tiers and what each one allows.
 *
 * This file is the single source of truth for every limit in the app. Nothing
 * else hard-codes a number: the screens read from here, `src/lib/quota.js`
 * decides against it, and when a real backend arrives it should serve exactly
 * this shape so the two cannot drift.
 *
 * Three of the four tiers are sold. `TRIAL` is not a product — it is the state
 * a new account starts in, for fourteen days, whichever plan they eventually
 * pick.
 *
 * The server grants that fortnight **once per person, for good**: deleting an
 * account and signing up again does not restart it. This file is the copy the
 * app reads so it can refuse before making a request; the server's copy is the
 * one that decides.
 */

export const SubscriptionTier = {
  TRIAL: "trial",
  STANDARD: "standard",
  PRO: "pro",
  /** Synapse, split five ways. Same limits, one bill. */
  FRIENDS: "friends",
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
    name: "14-Day Free Trial",
    priceKsh: 0,
    durationDays: 14,
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
  /**
   * Friends is Pro's limit set at a group price — deliberately the same
   * object, spread, rather than a second copy of the numbers. A limit changed
   * on Pro has to move here too, and a copy is how those drift apart.
   */
  [SubscriptionTier.FRIENDS]: {
    id: SubscriptionTier.FRIENDS,
    name: "Friends",
    // KES 250 each for five. Under Synapse's 350 a head, which is the whole
    // proposition, and over Focus so it never undercuts the plan a single
    // student would otherwise buy.
    priceKsh: 1250,
    durationDays: 30,
    /** How many students one payment covers, the payer included. */
    seats: 5,
    limits: null, // filled in below, from Pro
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

// Friends is Pro per seat. Assigned after the fact so there is exactly one
// definition of what the top tier allows.
PLAN_CONFIGS[SubscriptionTier.FRIENDS].limits = {
  ...PLAN_CONFIGS[SubscriptionTier.PRO].limits,
};

/** Seats a tier covers. Everything except Friends is a single student. */
export function seatsFor(tier) {
  return PLAN_CONFIGS[tier]?.seats ?? 1;
}

/**
 * What each person pays.
 *
 * Derived rather than stored beside the total: two numbers that have to agree
 * eventually stop agreeing, and this is the one a student checks against their
 * M-Pesa message.
 */
export function pricePerSeat(tier) {
  const plan = planFor(tier);
  return Math.round(plan.priceKsh / Math.max(1, seatsFor(tier)));
}

/**
 * What the student is shown and sold.
 *
 * The tier ids stay `standard` and `pro` because that is what the config, the
 * store and any future server speak; the names are what a student reads.
 */
/**
 * There is deliberately no `checkoutUrl` here any more.
 *
 * These cards used to carry three fixed `paystack.shop/pay/...` links. Two
 * things were wrong with that, and only one of them was the provider.
 *
 * A fixed link is the same page for every student, so the charge that comes
 * back names no account — the server is left reconciling against an email
 * typed into a form, which most accounts, signed in by phone, never have. And
 * the price lives on the provider's dashboard rather than in the plan table,
 * so the two drift silently.
 *
 * `billing.checkout()` in `src/api/endpoints.js` asks the server for a Kora
 * checkout minted for one student and one plan, with the payer's id in the
 * metadata. That is the only payment path now; a card with a hardcoded URL
 * would quietly bypass it.
 *
 * A build with no backend configured therefore cannot take a payment at all,
 * which is the honest outcome: it could never have credited one either.
 */
export const PLAN_CARDS = [
  {
    tier: SubscriptionTier.STANDARD,
    name: "Focus",
    tagline: "Enough for a normal semester",
    /** Outlined on white — the everyday option. */
    tone: "plain",
  },
  {
    tier: SubscriptionTier.PRO,
    name: "Synapse",
    tagline: "For a full load, and finals week",
    /**
     * Filled. Two identical white cards make a student compare nine lines of
     * small print to work out that one is the bigger plan; a shaded card says
     * it before they read a word.
     */
    tone: "shaded",
  },
  {
    tier: SubscriptionTier.FRIENDS,
    name: "Friends",
    tagline: "Synapse for five, split five ways",
    tone: "plain",
    /** Shown instead of the flat price: what it costs each person. */
    perSeatNote: true,
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
  alerts: "Timetable with deadline and session alerts",
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

  const seats = seatsFor(tier);

  return [
    // Stated on every card rather than once above them: it is part of what
    // each plan is, and a student comparing columns should not have to look
    // somewhere else to learn it applies to the one they are reading.
    { text: `${PLAN_CONFIGS[SubscriptionTier.TRIAL].durationDays}-day free trial`, available: true },
    ...(seats > 1
      ? [{ text: `${seats} students on one payment`, available: true }]
      : []),
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
  ];
}
