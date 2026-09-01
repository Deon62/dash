# Telling a student what is happening to their document

The complete app-facing contract for extraction: PDFs, scans, status, and the
notification. It replaces the earlier `APP_SCANS.md` and answers everything
raised in `ocr.md`.

**All five items from `ocr.md` are done and on master.** Part 1 was real and is
fixed — the cause was not quite what the diagnosis said, and the difference
matters for anyone reading the code later, so it is written down in §2.

---

## 1. What changed on the server

| `ocr.md` asked for | Status |
| --- | --- |
| 1. Status changes reachable through a cursor pull | **Fixed.** Every transition now moves `updated_at` from the application clock |
| 2. Push notification on terminal transitions, coalesced | **Built.** One per unit, quiet hours honoured, `failed`/`skipped` included |
| 3a. `page_count: 1` on a completed scan | **Was already set** — it travelled on the row that never arrived. Visible now |
| 3b. `/upload-url` refuses an oversized image | **Done.** Also refuses HEIC, before any bytes move |
| 3c. Leave the outage requeue visible | **Left alone**, and now covered by a test so nobody "fixes" it |

Nothing in this document requires a native change. It is all JS, so it ships OTA
(see `APP_UPDATES.md`).

---

## 2. Why the status never arrived

Worth six paragraphs because the wrong lesson here is expensive.

The diagnosis in `ocr.md` was that the worker did `UPDATE materials SET
extraction_status = 'done'` and left `updated_at` untouched. That is not what
was happening. `updated_at` carries `onupdate=func.now()`, it fires, and the
emitted SQL genuinely was:

```sql
UPDATE materials SET extraction_status=?, updated_at=now() WHERE id = ?
```

The bug was in **what `now()` returns**. In Postgres, `now()` is
`transaction_timestamp()` — the moment the *transaction opened*, not the moment
the row was written. And this worker's transaction opens, then downloads a file
from storage, then runs a vision model over it, and only then commits. On a scan
that is up to a minute of wall clock between the timestamp and the write.

So the row landed stamped with a time from before all of that. A device polling
in the meantime — which is exactly what the app does, every six seconds — held a
cursor *ahead* of the stamp, and the row was never returned again. Not on the
next pull, not on any pull, for the life of the install.

That is the worst shape a bug can have: invisible to every test that reads the
row back from the database, and permanent for the student.

**The fix** is one function, `set_status()`, that every transition goes through
and that stamps `updated_at` from the application clock at the instant of the
write. Not `statement_timestamp()`, which would be correct and Postgres-only.
Not a trigger, which would be correct and untestable against the SQLite the
suite runs on.

**The test** is the one `ocr.md` specified, and it is now in the suite four
times over — sync, record the cursor, run extraction, pull with that cursor,
assert the row comes back. Plus one that walks a material through all five
statuses and asserts the stamp moved every time, because a worker that stamps
four transitions out of five produces a bug that only shows up for one kind of
failure.

---

## 3. The state model

This is the part that decides whether the UX is good. Everything a student can
see about a document comes from two fields on a synced material.

```jsonc
{
  "id": "…",
  "unit_id": "…",
  "kind": "pdf",              // or "image"
  "title": "Week 4 notes",
  "extraction_status": "done", // pending | running | done | failed | skipped
  "extraction_error": null,    // a sentence, on failed and skipped
  "page_count": 12,            // null until done. Always 1 on a scan
  "updated_at": "2026-09-01T09:14:22Z"
}
```

Both status fields are **read-only**. They are absent from the push schema, the
server ignores them if you send them, and there is a test asserting a device
cannot write `done`. If it could, the tutor would be answering from a document
it has never read.

### What to draw

| Status | Terminal | Draw | Action |
| --- | --- | --- | --- |
| `pending` | No | Spinner — "Waiting to be read" | None |
| `running` | No | Spinner — "Reading your notes…" | None |
| `done` | **Yes** | Ready state, `page_count` pages | Ask about it |
| `failed` | **Yes** | Error, `extraction_error` verbatim | Retry / retake |
| `skipped` | **Yes** | Limit reached, `extraction_error` verbatim | Upgrade / show meter |

Three rules, all of which you already have:

1. **Never `status !== "done"` as the spinner condition.** `failed` and
   `skipped` are terminal — nothing will move them — so a spinner over either
   spins until the app is uninstalled.
2. **Print `extraction_error` verbatim.** It names the fix. Substituting
   "Something went wrong" throws away the only useful part.
3. **`failed` and `skipped` need different buttons.** `failed` is the file;
   `skipped` is the plan. Sending a `skipped` student to re-upload is a loop
   that cannot succeed.

### Timing to design against

| | Typical | Design for |
| --- | --- | --- |
| PDF, 20 pages | 2–5s | Spinner is fine |
| PDF, 300 pages | 10–30s | Spinner is fine |
| Scan (one photo) | 3–10s | Spinner is fine |
| Anything, queue backed up | Minutes | Your 3-minute stall notice |
| Provider outage | Until it clears | `running` → `pending`, no retry offered |

Your three-minute "taking longer than usual — still queued, nothing lost"
message is exactly right and should stay. With §2 fixed it is now what it was
meant to be: a rare safety net, not the message every scan ends up showing.

---

## 4. The notification

Built as specified in `ocr.md` §2.

### When it fires

On the transition into `done`, `failed` or `skipped` — the three terminal
states. The sweep runs on the worker's normal cadence, so expect it within about
a minute of extraction finishing.

### Coalescing

**One notification per unit**, not per material. Four photos filed into CS201 in
one sitting is one buzz. This is not a nicety — four buzzes for one action is
how somebody turns notifications off for the whole app.

### The payload

```json
{ "kind": "material", "id": "<unit_id>" }
```

`id` is the **unit**, not a material. A coalesced notification has no single
subject, and a tap that opens the unit puts every document in the batch on
screen. Route `kind: "material"` to the unit view.

### The copy

Generated server-side so it can count what actually happened:

| Situation | Title | Body |
| --- | --- | --- |
| One document | `CS201: Week 4 notes is ready` | `You can ask about it now.` |
| Four scans | `CS201: 4 pages are ready` | `4 documents are ready to ask about.` |
| Mixed | `CS201: 3 pages are ready` | `3 documents are ready to ask about. Blurry could not be read.` |
| Nothing succeeded | `CS201: something needs your attention` | `Blurry could not be read.` |

Failures are **named, not counted** — "1 could not be read" sends somebody into
the app to hunt for which one.

### What the app has to do

1. Handle `kind: "material"` in the notification tap handler → open the unit.
2. **Re-pull sync on tap**, before rendering. The notification is a nudge, not
   the data; the cards come from sync as always.
3. Nothing else. Do not build a separate notification-state store — the material
   rows already carry everything.

### What the server guarantees

- **Once per material, ever.** `materials.notified_at` records the fact.
- **Quiet hours delay, they do not cancel.** Notes filed at 22:30 are announced
  at 06:00, not dropped. (This is why the freshness window is 24 hours: six was
  the first guess and it silently turned every late-night filing into a
  cancelled notification.)
- **Nothing stale.** A document must have finished within 24 hours. Deploying
  this does not announce a term's worth of back-catalogue.
- **Foreground is not suppressed server-side.** The server cannot know what the
  app is showing. If the student is looking at the unit already, suppress it on
  the device — Expo's notification handler can decide per-notification.

---

## 5. Uploading a scan

Unchanged, except that two of the rules are now enforced on the server as well.

```
POST /api/v1/materials/upload-url
{ "material_id": "<uuid>", "unit_id": "<uuid>", "kind": "image",
  "filename": "notes.jpg", "mime_type": "image/jpeg", "byte_size": 1843200 }
```

**`/upload-url` now refuses, before any bytes move:**

- an image over **12 MB** — "Photos must be under 12MB so they can be read. Take
  it again at a lower resolution."
- anything that is not JPEG, PNG or WebP — including HEIC, with the iPhone
  setting named.

Your downscale-to-2000px-and-re-encode step should make both unreachable. Keep
it: it is what makes the upload fast on a mobile connection, and this server
check is a backstop for builds that do not have your code, not a replacement for
it.

### The allowance

From `GET /me/usage`:

```json
{ "ocr_pages_this_month": { "used": 12, "limit": 30, "unlimited": false, "resets_at": "2026-10-01" } }
```

`limit: 0` → the plan does not include scanning. Synapse and Friends get 30 a
month; Free and Focus get none. `resets_at` is already computed in the student's
own timezone — do not do calendar arithmetic in the app.

A scan that fails costs the student nothing: the allowance is checked before the
model is called and spent only after the whole job succeeds.

### What a transcription looks like

Plain prose. Headings and lists preserved. Diagrams come back as
`[diagram: labelled cross section of a leaf]` and unreadable patches as
`[illegible]`. If you preview extracted text, expect those markers and do not
render them as errors.

---

## 6. The full journey

What a student actually experiences now, end to end:

1. Photographs four pages of CS201 notes. Each card appears immediately —
   **"Waiting to be read"**.
2. Within seconds each moves to **"Reading your notes…"**, then to
   **ready, 1 page**. If the app is open, they watch it happen via polling.
3. They lock the phone and walk to a lecture. About a minute later:
   **"CS201: 4 pages are ready — 4 documents are ready to ask about."**
4. They tap. The app opens CS201, re-pulls sync, and shows four ready cards.
5. One was blurred. That card says **"We could not find any text in that photo.
   Make sure the page fills the frame and the writing is in focus."** with a
   Retake button. The notification said so too, by name.
6. They ask the tutor a question. The answer cites *your notes, page 1 of
   Organic Chemistry wk4*.

Step 3 is new. Steps 2, 4 and 5 are what §2 turned back on.

---

## 7. Checklist

Server side is done. What is left is in the app:

- [ ] Handle `kind: "material"` notification taps → open the unit
- [ ] Re-pull sync on notification tap before rendering
- [ ] Suppress the notification when the student is already viewing that unit
- [ ] Confirm the stall notice now rarely fires (it should be rare, not routine)
- [ ] Confirm `page_count` renders on scans — it arrives as `1`

Already built, listed so nothing is done twice: polling with a 20-minute
ceiling and foreground re-pull, terminal states, `extraction_error` verbatim,
per-status actions, the stall notice, image downscale and JPEG re-encode, the
allowance check before the camera opens.

---

## Related

- [APP_UPDATES.md](./APP_UPDATES.md) — shipping this. All JS, so OTA.
- [PLAN_LIMITS.md](./PLAN_LIMITS.md) — the page pool scans also count against.
- `ocr.md` — the app team's original report. Every item resolved above.
