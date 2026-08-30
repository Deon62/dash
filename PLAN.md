# Pricing and allowances — the change

Three changes, one spec. They ship together because two of them touch the same
screen and the same table.

1. **Allowances become monthly.** The daily ceiling goes away. A student can
   spend a whole month's questions the night before a CAT if that is when they
   need them.
2. **Every plan gains a 4-month option, called a Season.** The app shows a
   toggle: **Monthly** or **Season**.
3. **Free gets a second course unit**, and quizzes move onto the same monthly
   clock as everything else.

Nothing gets more expensive.

---

## 1. Monthly allowances

### Why

The daily cap punished exactly the behaviour the product is for. Revision is
not spread evenly across a month — it happens the night before a CAT, in one
six-hour sitting, and a student who hits "you have used today's 40 questions"
at 11pm is being refused at the only moment the app really mattered to them.

Nothing about the cost changes. **A month's allowance is a month's allowance
whether it is spent in one night or across thirty** — the bill is bounded by
the same number either way. The daily cap was never what protected the margin;
the monthly total is. So it can go.

### The numbers

| Plan | Questions per month | Quizzes per month | Was |
| --- | --- | --- | --- |
| Free | **30** (and 100 lifetime, unchanged) | 1, lifetime | 5/day |
| Focus | **400** | **20** | 40/day, 5/week |
| Synapse | **1,200** | Unlimited | 120/day |
| Friends | **1,200** per member | Unlimited | 120/day |

The lifetime ceiling on Free stays exactly as it is. It is what actually bounds
what a free account can cost, and it is doing that job well.

### When it resets

**The 1st of the month, in the student's own timezone** — the same clock the
daily reset moved onto when that was fixed. Everything now resets together:
questions, quizzes, OCR pages. One sentence explains the whole system:
*"Everything refills on the 1st."*

One quirk, accepted deliberately: a student who buys on the 28th gets the rest
of that month and a full fresh allowance three days later. It is generous at
the exact moment someone has just paid, which is a good moment to be generous,
and the plan's own duration still bounds the total.

### What this breaks

- `Limits.daily_ai_queries` becomes `monthly_ai_queries`. A rename across
  `plans.py`, `quota.py`, the usage endpoint, the admin console, and the app's
  own `src/theme/plans.js`.
- `METRIC_PERIODS["ai_queries"]` moves from `day_key` to `month_key`. Counters
  already filed under a day key are simply never read again — at deploy, every
  student starts a fresh month. That is a one-off giveaway of at most one
  month's allowance, and it is cheaper than any migration clever enough to
  avoid it.
- `quizzes_weekly` becomes `quizzes_monthly`, and `quiz_interval` loses
  `"weekly"` in favour of `"monthly"`.

### One thing this gives up

The daily cap was also an accidental burst guard — nothing else in the service
rate-limits the tutor. Losing it does not change what a month can cost, but it
does mean a scripted client could spend a student's whole allowance in a few
minutes. Worth a simple per-minute limit later. It is not a reason to hold this
change, because the money is bounded either way.

---

## 2. Season plans

### The name

**Season.** Four months — the length of a semester, without using a word that
belongs to the registrar rather than to us. It reads on a toggle the way a
season pass does, which is the association we want.

Shown as **Focus Season**, **Synapse Season**, **Friends Season**.

*(Rejected: "Term" and "Semester" are the university's words; "Streak" collides
with the streak feature; "Marathon" makes revision sound like suffering.)*

### The prices

| Plan | Monthly | Season (4 months) | Per month | Saving |
| --- | --- | --- | --- | --- |
| Focus | 150 | **KSh 500** | 125 | 17% |
| Synapse | 350 | **KSh 1,100** | 275 | 21% |
| Friends (6 seats) | 1,250 | **KSh 4,200** | 1,050 | 16% |

Friends also goes from **5 seats to 6** — 208 per head monthly, 175 per head on
a Season. Six is the number that makes "fill your group" reach a whole study
table, and it costs one more student's marginal usage.

### Why a 4-month option at all

Students budget per semester, because that is how fees work. And every KSh 150
charge pays a transaction fee with a fixed component — four small charges cost
meaningfully more to collect than one larger one. A Season is more cash up
front, a quarter of the fees, and a student who does not have to re-decide
every 30 days.

### Tier ids

New entries in `PLANS`, not a flag on the existing ones. `duration_days`
already carries the length, and a separate tier is what keeps a Kora charge
unambiguous about what was bought.

```
standard_season   Focus Season      KSh 500     120 days   1 seat
pro_season        Synapse Season    KSh 1,100   120 days   1 seat
friends_season    Friends Season    KSh 4,200   120 days   6 seats
```

Limits are identical to their monthly counterparts. A Season buys **time, not a
bigger allowance** — the same 400 or 1,200 a month, four times over. Say that
plainly on the card: a student expecting 4,800 questions in one lump will feel
cheated at week three.

`SELLABLE` grows to six. Nothing about `activate()`, expiry, or the webhook
changes — they already read `duration_days` off the plan.

---

## 3. The app

### The toggle

At the top of the plans screen, above the cards: a two-option segmented
control, `Monthly` on the left and `Season  Save 21%` on the right.

- **Monthly is selected by default.** The lower number is the honest default;
  a screen that opens on the bigger figure reads as a trick.
- The badge shows the **best** saving across all plans, rounded down — not a
  per-plan figure. It is a reason to tap, not a spec.
- Switching swaps the price on every card in place. Do not navigate and do not
  re-fetch: both sets arrive in one `GET /billing/plans` call.
- The selection is screen state. Do not persist it.

### On each card, in Season mode

- The big number is the **total** (`KSh 1,100`) — that is what M-Pesa will ask
  for, and a surprise at the STK prompt is a failed payment.
- Underneath, smaller: `KSh 275/month · 4 months`.
- On the plan the student already holds, in the mode they hold it, the button
  reads **Current plan** and is disabled.

### Copy

| Where | Text |
| --- | --- |
| Toggle | `Monthly` / `Season` |
| Season sub-line | `4 months · KSh 275/month` |
| Season badge | `Save 21%` |
| Allowance line, Focus | `400 questions a month` |
| Allowance line, Synapse | `1,200 questions a month` |
| Refill note | `Everything refills on the 1st.` |
| Usage screen | `400 questions this month · refills in 6 days` |

Nothing in the app should say "per day" any more. Search the strings for it.

### Checkout

Unchanged. The toggle decides which `tier` id goes to `POST /billing/checkout`;
everything downstream already works off the plan's own `price_ksh` and
`duration_days`.

---

## 4. API changes

### `GET /billing/plans`

Six entries instead of three, and each gains three fields so the app never does
pricing arithmetic:

```json
{
  "id": "pro_season",
  "name": "Synapse Season",
  "family": "synapse",
  "billing_period": "season",
  "price_ksh": 1100,
  "price_per_month_ksh": 275,
  "price_per_seat_ksh": 1100,
  "saving_percent": 21,
  "duration_days": 120,
  "seats": 1
}
```

- `family` — `focus` | `synapse` | `friends`. This is what pairs a card's two
  prices across the toggle. Do not pair them by parsing the id.
- `billing_period` — `monthly` | `season`.
- `price_per_month_ksh` and `saving_percent` — derived server-side, so the
  figure on the card and the badge cannot drift from the price actually
  charged. `saving_percent` is `0` on monthly entries.

An older app build ignores the new fields and shows three monthly plans — a
correct, if incomplete, screen. No forced update.

### `GET /me/usage`

- `ai_queries_today` → **`ai_queries_this_month`**
- `quiz_interval` now returns `monthly`, `lifetime` or `unlimited` — never
  `weekly`
- every metered entry gains **`resets_at`**, an ISO date in the student's
  timezone, so the app can write "refills in 6 days" without doing calendar
  maths and getting a leap year wrong

### Nothing else moves

`/billing/checkout`, `/billing/verify`, the Kora webhook, group join and seat
accounting are untouched.

---

## 5. Checklists

**Backend**

- [ ] `Limits.daily_ai_queries` → `monthly_ai_queries`, with the new numbers
- [ ] `quiz_interval` `weekly` → `monthly`; Focus 5/week → 20/month
- [ ] `METRIC_PERIODS`: `ai_queries` onto `month_key`; `quizzes_weekly` →
      `quizzes_monthly`, also monthly
- [ ] `check_ai_query` / `check_quiz` refusals say "this month", never "today"
- [ ] Free: `max_course_units` 1 → 2
- [ ] Friends: `seats` 5 → 6
- [ ] Three Season plans; `SELLABLE` grows to six
- [ ] `PlanOut` gains `family`, `billing_period`, `price_per_month_ksh`,
      `saving_percent`
- [ ] `UsageOut` rename, plus `resets_at` per meter
- [ ] Admin console reads `monthly_ai_queries`
- [ ] Tests: a month's allowance is spendable in one sitting; a Season activates
      for 120 days; a Season's refill is one month's allowance, not four

**App**

- [ ] `src/theme/plans.js` mirrors the new limits and all six plans
- [ ] Toggle, defaulting to Monthly
- [ ] Cards pair by `family`; total big, per-month small, in Season mode
- [ ] Usage screen reads `ai_queries_this_month` and `resets_at`
- [ ] No string says "per day" or "today's questions"
- [ ] Synapse's card sells OCR scans, page-exact citations and unlimited
      quizzes above the fold — the question count is not the reason to upgrade

---

## 6. Still open

- **The cost per question is an estimate.** `messages.prompt_tokens` and
  `completion_tokens` are recorded on every answer; a month of real data may
  say 1,200 is too tight or far too loose. These numbers are a starting
  position, not a finding.
- **The burst guard** (§1) — worth doing, not a blocker.
- **Seasons and the referral programme.** A Season buyer is worth four monthly
  ones and the reward should probably reflect that. Decide when that is built,
  not now.
