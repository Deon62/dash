/**
 * Subscription tiers and what each one allows.
 *
 * The copy the app reads. Nothing else hard-codes a number: the screens read
 * from here and `src/lib/quota.js` decides against it, so a limit can be shown
 * and refused with no connection at all.
 *
 * It is not the authority. The server enforces the same limits from its own
 * copy in `app/services/plans.py`, and serves the prices at
 * `/api/v1/billing/plans` so a change reaches a phone without an app store
 * release. Where the two disagree, the server is right — and a number changed
 * here has to be changed there too.
 *
 * Six of the eight tiers are sold: three plans, each in two lengths. `FREE` is
 * not a product — it is where an account starts and where it returns when a
 * plan lapses, and it does not run out.
 *
 * It replaced a fourteen-day trial. A trial is worth stealing, so it needed a
 * ledger of every phone number that had ever had one and a rule for what a
 * returning student got; free forever has nothing to steal, and none of that
 * survives. `TRIAL` is kept only because accounts still inside one have to
 * finish the fortnight they were promised.
 *
 * Allowances are monthly, not daily. The daily cap punished the behaviour the
 * product is for — revision happens the night before a CAT, in one sitting, and
 * "you have used today's 40 questions" at 11pm refused a student at the only
 * moment the app mattered to them. A month's allowance is a month's allowance
 * whether it is spent in one night or across thirty; the monthly total is what
 * bounds the bill, and it is doing that job unchanged.
 */

export const SubscriptionTier = {
  FREE: "free",
  STANDARD: "standard",
  PRO: "pro",
  /** Synapse, split six ways. Same limits, one bill. */
  FRIENDS: "friends",
  /**
   * The four-month lengths — a Season. Separate tier ids rather than a flag on
   * the tiers above, because `durationDays` already carries the length and a
   * distinct id is what keeps a charge unambiguous about what was bought.
   */
  STANDARD_SEASON: "standard_season",
  PRO_SEASON: "pro_season",
  FRIENDS_SEASON: "friends_season",
  /** Legacy. Not granted any more; drains to nothing as the last ones expire. */
  TRIAL: "trial",
};

/** How long one payment lasts. The toggle on the plans screen picks between them. */
export const BillingPeriod = {
  MONTHLY: "monthly",
  SEASON: "season",
};

/** Four months — a semester's length, without borrowing the registrar's word. */
export const SEASON_MONTHS = 4;

/** `-1` on a limit means unlimited. */
export const UNLIMITED = -1;

/**
 * The most course units any account may hold. Not a plan limit — a quality one.
 *
 * It used to be one: two on Free, four on Focus, ten on Synapse. Rationing the
 * one resource that costs nothing, at the worst possible moment — a student
 * building their timetable on the first evening hits it before the tutor has
 * answered a single question, and reads it as "this app is not built for my
 * course" rather than as a free tier.
 *
 * What survives is a flat ceiling on every plan, Free included, and no plan
 * lifts it. Retrieval is keyword search across one student's own corpus, and
 * precision falls off as that corpus grows; an answer assembled from a
 * fifty-unit haystack is worse than an honest refusal. That reasoning applies
 * to everybody equally, which is why this is a module constant rather than a
 * field on each plan — and why nothing that mentions it should send a student
 * to the paywall to buy something that does not exist.
 */
export const UNIT_HARD_CAP = 10;

/**
 * The limit sets, named once.
 *
 * A Season buys **time, not a bigger allowance** — the same 400 or 1,200 a
 * month, four times over — so the two lengths of a plan share one object here
 * rather than repeating the numbers. A copy is how a paid tier ends up
 * advertising a limit it does not have.
 */
const LIMITS = {
  free: {
    /**
     * Free's page pool is the same figure monthly and lifetime, and that is
     * what keeps it behaving exactly as it always has: the month can never
     * refill past the total. Nothing about the free plan got more generous.
     */
    monthlyPdfPages: 100,
    lifetimePdfPages: 100,
    maxSingleFileSizeMb: 10,
    // The whole pool in one document, so a single 100-page lecture PDF is
    // uploadable rather than refused for being one file.
    maxSingleFilePages: 100,
    monthlyAiQueries: 30,
    /**
     * The most this plan will ever answer, across every month it is held.
     *
     * Only free sets one, and it is unchanged. A monthly limit bounds the rate
     * and not the bill; free exists to show someone the product rather than to
     * be it, and this ceiling is what actually bounds what a free account can
     * cost. `UNLIMITED` on every paid tier, where the month is the bound.
     */
    lifetimeAiQueries: 100,
    quizzesPerInterval: { count: 1, interval: "lifetime", maxQuestions: 5 },
    timetableMode: "manual",
    sourceCitations: "basic",
    allowOcrScans: false,
    monthlyOcrPageLimit: 0,
  },
  focus: {
    monthlyPdfPages: 400,
    lifetimePdfPages: UNLIMITED,
    maxSingleFileSizeMb: 25,
    maxSingleFilePages: 100,
    monthlyAiQueries: 400,
    lifetimeAiQueries: UNLIMITED,
    quizzesPerInterval: { count: 20, interval: "monthly", maxQuestions: 10 },
    timetableMode: "alerts",
    sourceCitations: "exact_page",
    allowOcrScans: false,
    monthlyOcrPageLimit: 0,
  },
  synapse: {
    monthlyPdfPages: 1500,
    lifetimePdfPages: UNLIMITED,
    maxSingleFileSizeMb: 50,
    maxSingleFilePages: 300,
    monthlyAiQueries: 1200,
    lifetimeAiQueries: UNLIMITED,
    quizzesPerInterval: { count: UNLIMITED, interval: "unlimited", maxQuestions: 20 },
    timetableMode: "ai_sync",
    sourceCitations: "deep_summary",
    allowOcrScans: true,
    monthlyOcrPageLimit: 30,
  },
  /**
   * The fortnight is the ceiling on a trial — it ends on its own — so the
   * monthly figure here only has to be sane for the fourteen days it can be
   * held. Nothing is sold on it and nothing new is granted it.
   */
  trial: {
    monthlyPdfPages: 100,
    lifetimePdfPages: UNLIMITED,
    maxSingleFileSizeMb: 10,
    maxSingleFilePages: 30,
    monthlyAiQueries: 200,
    lifetimeAiQueries: UNLIMITED,
    quizzesPerInterval: { count: 2, interval: "lifetime", maxQuestions: 5 },
    timetableMode: "manual",
    sourceCitations: "basic",
    allowOcrScans: false,
    monthlyOcrPageLimit: 0,
  },
};

export const PLAN_CONFIGS = {
  [SubscriptionTier.FREE]: {
    id: SubscriptionTier.FREE,
    name: "Free",
    priceKsh: 0,
    /** Never. A countdown here would be a paywall with no date on it. */
    durationDays: 0,
    limits: LIMITS.free,
  },
  [SubscriptionTier.TRIAL]: {
    id: SubscriptionTier.TRIAL,
    name: "14-Day Free Trial",
    priceKsh: 0,
    durationDays: 14,
    limits: LIMITS.trial,
  },

  // --- Monthly -------------------------------------------------------------

  [SubscriptionTier.STANDARD]: {
    id: SubscriptionTier.STANDARD,
    name: "Focus",
    priceKsh: 150,
    durationDays: 30,
    billingPeriod: BillingPeriod.MONTHLY,
    family: "focus",
    limits: LIMITS.focus,
  },
  [SubscriptionTier.PRO]: {
    id: SubscriptionTier.PRO,
    name: "Synapse",
    priceKsh: 350,
    durationDays: 30,
    billingPeriod: BillingPeriod.MONTHLY,
    family: "synapse",
    limits: LIMITS.synapse,
  },
  /**
   * Friends is Synapse's limit set at a group price — deliberately the same
   * object, not a second copy of the numbers.
   */
  [SubscriptionTier.FRIENDS]: {
    id: SubscriptionTier.FRIENDS,
    name: "Friends",
    // KES 208 each for six. Under Synapse's 350 a head, which is the whole
    // proposition, and over Focus so it never undercuts the plan a single
    // student would otherwise buy.
    priceKsh: 1250,
    durationDays: 30,
    billingPeriod: BillingPeriod.MONTHLY,
    family: "friends",
    /** How many students one payment covers, the payer included. */
    seats: 6,
    limits: LIMITS.synapse,
  },

  // --- Season: four months, one payment ------------------------------------

  [SubscriptionTier.STANDARD_SEASON]: {
    id: SubscriptionTier.STANDARD_SEASON,
    name: "Focus Season",
    priceKsh: 500,
    durationDays: 120,
    billingPeriod: BillingPeriod.SEASON,
    family: "focus",
    limits: LIMITS.focus,
  },
  [SubscriptionTier.PRO_SEASON]: {
    id: SubscriptionTier.PRO_SEASON,
    name: "Synapse Season",
    priceKsh: 1100,
    durationDays: 120,
    billingPeriod: BillingPeriod.SEASON,
    family: "synapse",
    limits: LIMITS.synapse,
  },
  [SubscriptionTier.FRIENDS_SEASON]: {
    id: SubscriptionTier.FRIENDS_SEASON,
    name: "Friends Season",
    priceKsh: 4200,
    durationDays: 120,
    billingPeriod: BillingPeriod.SEASON,
    family: "friends",
    seats: 6,
    limits: LIMITS.synapse,
  },
};

/** Seats a tier covers. Everything except Friends is a single student. */
export function seatsFor(tier) {
  return PLAN_CONFIGS[tier]?.seats ?? 1;
}

/**
 * What each person pays, over the whole plan.
 *
 * Derived rather than stored beside the total: two numbers that have to agree
 * eventually stop agreeing, and this is the one a student checks against their
 * M-Pesa message.
 */
export function pricePerSeat(tier) {
  const plan = planFor(tier);
  return Math.round(plan.priceKsh / Math.max(1, seatsFor(tier)));
}

/** Months one payment covers. Used for the per-month line under a Season price. */
export function monthsFor(tier) {
  return Math.max(1, Math.round((planFor(tier).durationDays || 30) / 30));
}

/**
 * What a Season works out at per month.
 *
 * The server sends `price_per_month_ksh` and the screen prefers it — this is
 * the fallback for a card drawn before the prices land, or with no connection
 * at all.
 */
export function pricePerMonth(tier) {
  return Math.round(planFor(tier).priceKsh / monthsFor(tier));
}

/**
 * What a Season saves against paying monthly, as a percentage.
 *
 * Floored, never rounded up: a badge that claims 17% on a plan that saves
 * 16.7% is the kind of small lie a student can check with a calculator.
 * `saving_percent` from the server wins where it has arrived.
 */
export function savingPercent(family) {
  const monthly = tierFor(family, BillingPeriod.MONTHLY);
  const season = tierFor(family, BillingPeriod.SEASON);
  if (!monthly || !season) return 0;

  const full = planFor(monthly).priceKsh * monthsFor(season);
  if (!full) return 0;

  return Math.max(0, Math.floor((1 - planFor(season).priceKsh / full) * 100));
}

/**
 * What the student is shown and sold.
 *
 * One card per *family*, not per tier: Focus is one product with two lengths,
 * and the toggle swaps the price in place rather than doubling the screen. The
 * pairing is by family and never by parsing an id — the server sends `family`
 * on every plan for exactly this reason.
 *
 * There is deliberately no `checkoutUrl` here any more. These cards used to
 * carry three fixed `paystack.shop/pay/...` links, and two things were wrong
 * with that. A fixed link is the same page for every student, so the charge
 * that comes back names no account — the server is left reconciling against an
 * email typed into a form, which most accounts, signed in by phone, never
 * have. And the price lives on the provider's dashboard rather than in the
 * plan table, so the two drift silently.
 *
 * `app/pay.jsx` asks the server to start a payment for one student and one
 * plan. A build with no backend configured therefore cannot take a payment at
 * all, which is the honest outcome: it could never have credited one either.
 */
export const PLAN_CARDS = [
  {
    family: "focus",
    name: "Focus",
    tagline: "Enough for a normal semester",
    /** Outlined on white — the everyday option. */
    tone: "plain",
    tiers: {
      [BillingPeriod.MONTHLY]: SubscriptionTier.STANDARD,
      [BillingPeriod.SEASON]: SubscriptionTier.STANDARD_SEASON,
    },
  },
  {
    family: "synapse",
    name: "Synapse",
    tagline: "For a full load, and finals week",
    /**
     * Filled. Two identical white cards make a student compare nine lines of
     * small print to work out that one is the bigger plan; a shaded card says
     * it before they read a word.
     */
    tone: "shaded",
    tiers: {
      [BillingPeriod.MONTHLY]: SubscriptionTier.PRO,
      [BillingPeriod.SEASON]: SubscriptionTier.PRO_SEASON,
    },
  },
  {
    family: "friends",
    name: "Friends",
    tagline: "Synapse for six, split six ways",
    tone: "plain",
    /** Shown instead of the flat price: what it costs each person. */
    perSeatNote: true,
    tiers: {
      [BillingPeriod.MONTHLY]: SubscriptionTier.FRIENDS,
      [BillingPeriod.SEASON]: SubscriptionTier.FRIENDS_SEASON,
    },
  },
];

/** The tier a card sells in one mode of the toggle. */
export function tierFor(family, period = BillingPeriod.MONTHLY) {
  return PLAN_CARDS.find((card) => card.family === family)?.tiers[period] ?? null;
}

/** The card a tier belongs to, whichever of its two lengths was bought. */
export function cardFor(tier) {
  return PLAN_CARDS.find((card) => Object.values(card.tiers).includes(tier)) ?? null;
}

/** `monthly` or `season`. Free and trial have no billing period at all. */
export function periodOf(tier) {
  return PLAN_CONFIGS[tier]?.billingPeriod ?? null;
}

export function isSeason(tier) {
  return periodOf(tier) === BillingPeriod.SEASON;
}

export function planFor(tier) {
  // An unknown tier resolves to the floor, never upward. The server does the
  // same with a tampered or legacy value, including the old "expired".
  return PLAN_CONFIGS[tier] ?? PLAN_CONFIGS[SubscriptionTier.FREE];
}

export function limitsFor(tier) {
  return planFor(tier).limits;
}

/**
 * What a student calls the plan they are on.
 *
 * A Season is named as one — "Focus Season" — because the length is the whole
 * difference between it and the plan beside it, and a badge reading "Focus" on
 * an account with four months left tells them nothing they need.
 */
export function planName(tier) {
  return planFor(tier).name;
}

/**
 * How many course units an account may hold.
 *
 * Takes no tier, and that is the signature doing the talking: there is one
 * answer for everybody. It stays a function rather than becoming a bare
 * constant at the call sites so that the day a limit here needs a reason
 * again, there is one place to put it.
 */
export function unitCap() {
  return UNIT_HARD_CAP;
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
 *
 * The order is the selling order, not the config's order. Scanning, page-level
 * citations and unlimited quizzes come first because they are why anyone moves
 * up to Synapse; the question count is a number every plan has, and leading
 * with it turns three products into one product at three sizes.
 *
 * Anything that does not vary by plan is not here at all — the course-unit cap
 * most of all. A line identical on all three cards is not a feature, and on the
 * cheapest card it reads as the thing the dearer one gives you more of.
 */
export function planFeatures(tier) {
  const limits = limitsFor(tier);
  const quiz = limits.quizzesPerInterval;

  const quizLine =
    quiz.count === UNLIMITED
      ? `Unlimited quizzes, up to ${count(quiz.maxQuestions, "question")}`
      : quiz.interval === "monthly"
        ? `${count(quiz.count, "quiz", "quizzes")} a month, up to ${count(quiz.maxQuestions, "question")}`
        : `${count(quiz.count, "quiz", "quizzes")} in total, up to ${count(quiz.maxQuestions, "question")}`;

  const seats = seatsFor(tier);

  // Free's pool is the same number twice, so it is stated once, as a total —
  // "100 PDF pages a month" on a plan that only ever gets 100 is a promise of
  // a refill that cannot happen.
  const pages =
    limits.lifetimePdfPages !== UNLIMITED
      ? `${limits.lifetimePdfPages} PDF pages in total`
      : `${limits.monthlyPdfPages} PDF pages a month`;

  return [
    // No trial line any more. There is no fortnight to advertise — the free
    // plan is always there, and a card promising a trial that does not exist
    // is the worst kind of stale copy.
    ...(seats > 1
      ? [{ text: `${seats} students on one payment`, available: true }]
      : []),
    {
      // Listed on every card, struck through where it is not included: the
      // difference between the plans is the thing being sold, and a feature
      // that simply vanishes from the cheaper card is a difference nobody sees.
      text: limits.allowOcrScans
        ? `Scan handwritten notes, ${limits.monthlyOcrPageLimit} pages a month`
        : "Scan handwritten notes",
      available: limits.allowOcrScans,
    },
    { text: CITATION_COPY[limits.sourceCitations], available: true },
    { text: quizLine, available: true },
    // No course-unit line. Every plan carries the same ten, so listing it on
    // three cards sold nothing and implied the opposite — that the card above
    // has more of them.
    {
      text: `${count(limits.monthlyAiQueries, "AI question")} a month`,
      available: true,
    },
    { text: pages, available: true },
    {
      text: `Up to ${limits.maxSingleFileSizeMb}MB and ${limits.maxSingleFilePages} pages per file`,
      available: true,
    },
    { text: TIMETABLE_COPY[limits.timetableMode], available: true },
  ];
}
