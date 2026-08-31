# Where the plans actually bite

What each tier limits, why it limits that and not something else, and the two
changes made on 2026-08-31 that moved the ceiling off the cheap thing and onto
the expensive one.

The authority for every number here is `app/services/plans.py`. The app ships a
copy in `src/theme/plans.js` and the console ships one in `admin/src/lib/plans.js`,
both for drawing a pricing card before a fetch lands. When they disagree, the
server wins — and changing a number here means changing it in all three in the
same commit.

---

## 1. What a student actually costs

Worth stating plainly, because the limits only make sense against it:

| Thing | What it costs us | Metered as |
| --- | --- | --- |
| An AI question | Real money, per question. The largest line item. | `ai_queries`, `ai_queries_lifetime` |
| A page extracted | Extraction once, storage forever, and every later retrieval reads it | `pdf_pages`, `pdf_pages_lifetime` |
| An OCR page | More than a text page — it is a vision call | `ocr_pages` |
| A quiz | An AI question wearing a different hat | `quizzes_*` |
| **A course unit** | **Effectively nothing. A row with a code and a title.** | — |

That last row is the whole argument for the first change below.

---

## 2. Units are no longer a plan limit

### What was wrong

`Limits.max_course_units` rationed units by tier — 2 on Free, 4 on Focus, 10 on
Synapse. It gated the one resource that costs nothing, and it did so at the
worst possible moment in the product.

A Kenyan university student takes five or six units a semester. The first thing
anyone does after installing is build their timetable. On Free they got two
units in and hit a wall — before the tutor had answered a single question, before
the app had shown them anything worth paying for. The refusal did not read as
"this is the free tier"; it read as "this app is not built for my course".

And it bounded nothing. Six units with no material in them cost the same as two.
Every real cost was already metered separately.

### What it is now

One ceiling, `UNIT_HARD_CAP = 10`, on every tier including Free. It is not for
sale and no plan lifts it.

It still exists, for a reason that has nothing to do with billing: retrieval is
keyword search across one student's own corpus (`app/services/ai/retrieval.py`),
and precision falls off as that corpus grows. An answer assembled from a
fifty-unit haystack is worse than an honest refusal. Ten is a **quality** ceiling
and applies to everyone equally, which is why it is a module constant rather than
a field on each plan.

### Changed

| File | Change |
| --- | --- |
| `app/services/plans.py` | `max_course_units` removed from `Limits`. `unit_cap()` now takes no tier and returns `UNIT_HARD_CAP`. |
| `app/services/quota.py` | `check_unit_cap` deleted — it had no callers; the guard that runs lives in sync. |
| `app/services/sync.py` | `unit_guard` uses the flat cap. Its rejection message no longer says "for this plan" — no plan lifts it, and implying one sends a student to the paywall to buy something that does not exist. |
| `app/api/v1/routes/settings.py` | The `course_units` meter reports `UNIT_HARD_CAP`, never unlimited, never a reset date. |
| `admin/src/lib/plans.js`, `admin/src/pages/Ops.jsx` | `UNIT_HARD_CAP` mirrored; the catalogue table shows one figure for all plans. |

**Still to do in the app repo:** drop `maxCourseUnits` from `src/theme/plans.js`
and stop drawing the units bar as a plan benefit. Until then the app refuses
locally before the server would — a stale client is conservative here, not
wrong, so this is not a blocking release.

---

## 3. The page pool refills on paid plans

### What was wrong

`METRIC_PERIODS["pdf_pages"]` was `_lifetime` for **every** tier. Synapse's 1,500
pages never came back.

A student who paid for two semesters eventually could not upload anything, ever
again, on a live subscription. Worse, the failure was unexplainable: `resets_on`
returns `None` for a lifetime meter, so the app had no reset date to show and
could only say "you have used your pages" to somebody currently paying.

A lifetime pool is the right shape for Free — it is what bounds an account that
never converts, and it is the same reasoning as `lifetime_ai_queries`. It is the
wrong shape for a plan whose whole proposition is a renewing period.

### What it is now

Two meters, exactly mirroring the `ai_queries` design that was already here:

| Metric | Period | Ceiling |
| --- | --- | --- |
| `pdf_pages` | Monthly, on the student's own clock | `Limits.total_pdf_pages_pool` |
| `pdf_pages_lifetime` | Never resets | `Limits.lifetime_pdf_pages` |

| Tier | Monthly | Lifetime |
| --- | --- | --- |
| Free | 100 | 100 |
| Focus / Focus Season | 400 | unlimited |
| Synapse / Friends (+ Seasons) | 1,500 | unlimited |

Both figures are 100 on Free, which is what keeps it behaving exactly as before:
the month can never refill past the total. Nothing about the free plan got more
generous.

`check_pdf_pages` tests the lifetime ceiling **first**, and says something
different when it trips — telling somebody to wait for a reset that is never
coming is worse than telling them the truth. Same ordering, same reason, as
`check_ai_query`.

`record_pdf_pages` spends against both meters in one call, so the lifetime
counter cannot be silently forgotten at a call site. The monthly pool would still
work if it were; nothing would look broken while the ceiling that bounds a
never-converting account quietly did not exist.

### The trade being made

The pool changes meaning: it was a cap on **how much material you can have
filed**, and it is now a cap on **how much you can add per month**. A Synapse
student uploading 1,500 pages every month for a year ends up with far more stored
than the old ceiling allowed.

That is the right trade here — storage is cheap, and the corpus-quality risk is
held by `UNIT_HARD_CAP` rather than by the page pool — but it is a real change
and the monthly figures are the dial if it turns out to be too generous. Watch
`GET /admin/ops/plans` against actual extraction volume for a month before
touching them.

### Changed

| File | Change |
| --- | --- |
| `app/services/plans.py` | `lifetime_pdf_pages` added to `Limits`; set on every plan. |
| `app/services/quota.py` | `pdf_pages` is monthly; `pdf_pages_lifetime` added. `check_pdf_pages` tests both. `record_pdf_pages` added. |
| `app/workers/extraction.py` | Records through `record_pdf_pages` instead of one raw `record_usage`. |
| `app/api/v1/routes/settings.py` | `GET /me/usage` gains `pdf_pages_this_month` and `pdf_pages_total`. |
| `admin/src/pages/Ops.jsx`, `UserDetail.jsx` | Both pool figures shown; the new metric mapped. |
| `alembic/versions/…_pdf_page_pool_periods.py` | Data migration, below. |

### One thing that would have broken silently

`GET /me/usage` built its `course_units` meter by borrowing the `"pdf_pages"`
metric name, purely because that key happened to be a lifetime one and therefore
returned `resets_at: None`. The moment `pdf_pages` became monthly, the units bar
would have started drawing a countdown to a refill that never happens. It is now
constructed by hand with no metric at all.

---

## 4. The migration

`alembic/versions/20260831_0900_f4c1d83a52b7_pdf_page_pool_periods.py`

No schema change — `usage_counters` already stores an arbitrary
`(metric, period_key)` pair. One statement:

```sql
UPDATE usage_counters
   SET metric = 'pdf_pages_lifetime'
 WHERE metric = 'pdf_pages' AND period_key = 'lifetime';
```

Every existing `pdf_pages` row has `period_key = 'lifetime'`, because that is the
only period the metric ever had, and total-pages-ever is precisely what
`pdf_pages_lifetime` means.

**Renaming rather than leaving them is the point.** Left alone, those rows would
simply stop being read, and every free account that had already spent its hundred
pages would silently get a second hundred — the one ceiling that bounds what a
never-converting account can cost us, reset across the entire existing base by a
deploy.

Nothing is written for the new monthly metric. The absence of a row *is* zero, so
everybody starts the current month with a full pool. That is intended.

Rolling deploy is safe in both directions for the duration of the release: the
old code reads `pdf_pages`/`lifetime` and finds nothing, which fails open, not
shut. Run the migration and the deploy together and the window is seconds.

---

## 5. What did not change

- **Free is still a demonstration, not a product.** 30 questions a month, 100
  ever, 100 pages ever, one quiz. The lifetime AI ceiling is untouched.
- **Reads stay open on every tier.** A lapsed student keeps their notes, their
  timetable, and their ability to export or delete. Locking someone out of work
  they wrote is not a business model.
- **File size and per-file page limits** are unchanged and still checked before a
  signed upload URL is issued — afterwards is too late, the file is already in the
  bucket and already cost the student their data.
- **Everything still refills on the 1st**, on the student's own clock, not UTC.

---

## 6. Tests

| Test | Guards |
| --- | --- |
| `test_abuse.py::test_units_are_not_a_thing_a_plan_buys` | `unit_cap` never varies by tier again |
| `test_abuse.py::test_a_paid_page_pool_refills` | `pdf_pages` stays monthly and paid tiers stay lifetime-unlimited |
| `test_abuse.py::test_free_is_a_demonstration_not_a_product` | Free's four numbers |
| `test_sync.py::test_the_unit_cap_rejects_the_row_not_the_request` | The cap refuses the row, not the push — and the message does not mention a plan |
| `test_sync.py::test_editing_an_existing_unit_is_never_capped` | Renaming at the cap still works |
| `test_settings.py::test_usage_reports_the_free_meters` | The units bar has no reset date; both page meters report correctly |

382 passing.
