# ALS — UI/UX review

A pass over the interface only. Backend is out of scope except where a UI fix
cannot be done on the device alone; those are marked **Backend touch** and say
exactly what is needed.

Reviewed at `1.1.0`, against the screens in `app/` and the components in
`src/components/`.

---

## Status

Eight of the ten are now implemented. The findings below are kept as written —
they are the reasoning, and it is worth having when someone asks why a thing
works the way it does.

| # | Finding | Status |
|---|---|---|
| 1 | Markdown rendering | **Done** — `src/components/Markdown.jsx` |
| 2 | Stop a streaming answer | **Done** — send becomes stop |
| 3 | Search | Open |
| 4 | Pull-to-refresh | **Done** — `Screen`, adopted on 11 screens |
| 5 | Sync status strip | Open |
| 6 | Undo on destructive actions | **Done** — `useUndoable` + `UndoBar` |
| 7 | Font-scaling caps | **Done** — `src/theme/type.js` |
| 8 | First win after onboarding | **Done** — lands on Knowledge, openers on Study |
| 9 | Offline pre-emption | **Done, and then some** — see below |
| 10 | Retry a failed answer | **Done** — retries into the same message ids |

Two notes on what changed while building.

**A worse offender than either delete named in #6.** `app/archive.jsx` deleted a
material *permanently* on a single tap, with no dialog and no undo, from a
button sitting next to Restore on rows a student is scrolling through precisely
because they are tidying up. That is where the undo bar went first. The unit
delete keeps its confirmation dialog on purpose: it is rare, its blast radius is
a whole semester, and undoing it would have to survive the navigation back to
the units list.

**Offline became a gate, not a hint (#9).** `expo-network` now drives
`useOnline`, and `OfflineGate` replaces the whole page — every page — the moment
connectivity drops, keeping only the tab bar. That is broader than this review
recommended, and it was a deliberate product call, so the trade is written down
here and in the header comment of `src/components/OfflineGate.jsx`:

- **What it buys.** An app that behaves normally until one action fails teaches
  people the app is broken. Being told early and plainly is worth something,
  and the illustration reads faster than any sentence.
- **What it costs.** The store is a complete local cache. Notes, units, the
  timetable, deadlines and the flashcard deck all render with the radio off —
  that is what `src/lib/sync.js` is for, and what `RELEASE.md` promises. Gating
  them hides material the student already has, on the phone they have it on, in
  the exact conditions the offline design was built for.

`NETWORK_OPTIONAL` in `OfflineGate` is the dial. It is empty, so everything is
gated. Adding a route name to it gives that screen its cached content back and
nothing else changes. `timetable`, `units`, `archive` and the calendar are the
obvious first four if this proves too broad in testing — none of them has ever
needed the network to render a single pixel.

`OfflineState` is also still used in-thread on the Study tab for a question that
fails mid-flight, with a retry.

---

## Where this app already is

Worth stating first, because it changes what the rest of this list means.

The craft level is high and unusually consistent. 80 `Pressable`s carry 82
`accessibilityLabel`s and 78 `accessibilityRole`s — near-total coverage, which
most shipped apps do not have. Haptics are deliberate rather than sprinkled
(`impact("light")` on navigation, `notify("success")` on completion). Empty
states exist on nine screens and are written as sentences a person would say.
`Screen.jsx` puts the status-bar inset on the container rather than the scroll
content, which is the correct and commonly-missed choice. `systemAlerts.js`
derives every app-level warning from state rather than storing it, so an alert
cannot outlive its cause.

None of the findings below are about polish. The interface is polished. They
are about **capability that is missing** and **states the interface cannot
currently express** — which is a different and, at this stage, more valuable
list.

Ordered by what a real student hits first and hardest.

---

## 1. The tutor's answers render as raw markdown — `app/(tabs)/study.jsx`

**Severity: high. This is the product's main surface.**

`Bubble` renders `message.text` inside a single `<Text>`. There is no markdown
renderer anywhere in the project — I checked `src/`, `app/` and
`package.json`.

Language models emit markdown by default and heavily: `**bold**` for the term
being defined, `##` for sections, `-` and `1.` for the steps of a derivation,
backticks for code, `>` for a quoted passage. All of it currently reaches the
student as literal punctuation. A grounded, well-structured answer about
hashing arrives looking like this:

```
## How a hash table works

A hash function maps a **key** to an index. The steps are:

1. Compute `h(k)`
2. Reduce modulo the table size
```

That is the single largest gap between what the app produces and what the
student sees, and it undercuts the whole promise — an answer that looks
unformatted reads as an answer that was not thought about.

**Two ways to fix it, and they are not equivalent:**

- **Render markdown on the device.** Correct, and the better outcome: headings,
  bold, lists and code blocks are exactly the shapes an explanation wants. Costs
  a dependency and some styling work to keep it inside the app's type scale.
  Note that this also has to work *during* streaming, on a half-finished
  document — an unclosed `**` or a code fence with no end must not make the
  bubble flicker between styles as tokens land. Parse the accumulated text each
  frame and accept that the last line is provisional.
- **Tell the model to write plain prose.** Cheaper and worse. Lists and steps
  are genuinely the right form for a lot of coursework, and prohibiting them
  makes answers harder to follow, not easier.

Take the first. **Backend touch:** none required if you render on the device.
If you take the second path instead, the system prompt in the tutor service has
to say the client renders plain text and that markdown syntax must not be used
— and that instruction has to be reliable, because a single stray `**` is now a
visible bug.

Related, and cheap once markdown renders: the copy button added in
`Bubble` deliberately copies the raw text, which is correct — the markdown is
what makes it useful pasted into notes. Keep that even after rendering changes.

---

## 2. A streaming answer cannot be stopped — `app/(tabs)/study.jsx`, `src/lib/tutor.js`

**Severity: high. Cheap to fix.**

`askTutor` already accepts a `signal` and threads it correctly into the
`AbortController` in `openStream` (`src/lib/tutor.js:98-101`). **Nothing ever
passes one.** `study.jsx` calls `askTutor` with no signal at all.

The consequence: a student who mistypes a question, or realises three lines in
that they asked the wrong thing, has no way out. The composer is disabled while
`thinking` is true, so they cannot ask the right question either. They wait —
up to `STREAM_TIMEOUT_MS`, which is **two minutes** — watching an answer they
do not want, having spent a query from their allowance to get it.

Every chat interface people have used has a stop button. Its absence reads as
the app being stuck.

**Fix:** hold an `AbortController` in a ref, pass `signal` through, and swap the
send button for a stop button while `thinking`. The plumbing already exists;
this is an afternoon.

**Backend touch:** none strictly — aborting the fetch closes the connection. But
worth checking the tutor service actually notices client disconnect and stops
generating, rather than paying for tokens nobody will read. That is a cost
question, not a correctness one.

---

## 3. Nothing in the app is searchable

**Severity: high, and it grows with every week of use.**

There is no search anywhere. The only `TextInput` with a magnifying glass in the
whole project is the country picker in `src/components/CountryPicker.jsx:84`.

To find one lecture note, a student opens Knowledge, picks the unit, and scans
the list. That is fine at 8 items. At 60 — one semester, six units — it is the
thing that makes people stop filing, because filing something they cannot find
again is wasted effort.

The likely counter-argument is that **Ask is the search**. It is not, for two
reasons. It spends a metered AI query to answer "where did I put that", which is
an expensive way to ask a cheap question. And it returns an *answer*, not the
*file* — a student who wants to reread their own slides before an exam needs to
open them, not to be told about them.

**Fix:** a local filter is enough and needs no server. Everything is already on
the device: `materials` carry `title` and, for notes, `body`; `chats` carry
`title` and messages. A single field on Knowledge filtering title-and-body, plus
one in the chat drawer, covers most of it.

**Backend touch:** none. This is a pure client feature over data already synced.
Server-side search over PDF text would be a genuine second step later, since the
device never sees extracted PDF text — but do not start there.

---

## 4. No pull-to-refresh, anywhere — `src/components/Screen.jsx`

**Severity: medium-high for this app specifically.**

`Screen` wraps every list page in a `ScrollView` with no `RefreshControl`. There
is no `RefreshControl` in the codebase at all.

This matters more here than in most apps because of the architecture. The device
is a cache and an outbox; sync runs on focus, on app-state change, and on a
debounce after writes (`src/lib/bootstrap.js`). All of that is invisible. When a
student suspects something is stale — a friend's payment has not appeared, a
note filed on their laptop has not arrived — the gesture they will make is a
pull-down. Currently it does nothing, which reads as the app being frozen rather
than as the gesture being unsupported.

It is also the missing manual retry. When sync fails, the student's only
recourse is to wait for the next automatic attempt.

**Fix:** an optional `onRefresh` prop on `Screen`, wired to `sync({ force: true })`,
opted into by Home, Knowledge, Units, Timetable and Billing. One component
change, a handful of one-line adoptions.

**Backend touch:** none. `sync({ force: true })` already exists.

---

## 5. Sync trouble is only visible behind a bell icon

**Severity: medium.**

`systemAlerts.js` is well designed — derived from state, correctly gated on
`syncError && hasPendingChanges` so a stale warning cannot linger. The problem
is where it surfaces: a dot on the bell, on the Home tab only
(`app/(tabs)/index.jsx:56`).

A student working entirely in Knowledge and Study for two days, on bad campus
wifi, with a growing pile of unsent notes, sees nothing. The information exists
and is correct; it is just somewhere nobody is looking.

**Fix:** a thin, dismissible strip below the header on any screen while
`syncError && hasPendingChanges` — *"3 changes waiting to sync · Retry"* —
tappable to force a sync. Not a modal, not a toast; a persistent condition
deserves a persistent, quiet line. The existing `Notice` component is close to
the right shape already.

**Backend touch:** none.

---

## 6. Destructive actions confirm, but cannot be undone

**Severity: medium.**

Deleting a unit takes its knowledge, deadlines and session times with it
(`app/unit/[id].jsx:354`). Account deletion is guarded the same way
(`app/settings/index.jsx:152`). Both use `ConfirmDialog` with honest copy —
*"This can't be undone."*

Confirmation dialogs are the weaker pattern for anything a person does more than
rarely. People learn to dismiss them, and a dialog cannot help someone who
tapped the wrong row and confirmed on autopilot. Undo can.

The architecture already supports it. Deletions leave **tombstones**
(`EMPTY_TOMBSTONES` in `src/store/useStudyStore.js`), and `sync.js` pushes them
separately. A grace period is a matter of holding the tombstone back.

**Fix:** for unit and material deletion, remove from the visible list
immediately, show a *"Deleted · Undo"* strip for 6–8 seconds, and only write the
tombstone when it lapses. Keep the confirmation dialog for account deletion —
that one genuinely is irreversible and rare.

**Backend touch:** none, if the tombstone push is what you delay. Do **not**
implement this by deleting server-side and restoring — that is a much harder
problem and the local delay is sufficient.

---

## 7. Large system font will break fixed-height chrome

**Severity: medium. Invisible until a real user hits it.**

There is no `maxFontSizeMultiplier` or `allowFontScaling` anywhere in the
project. Every size is a fixed pixel value with fixed leading — `text-[14.5px]
leading-[21px]` and so on throughout.

React Native `<Text>` scales with the OS font setting by default. Android
accessibility settings go to 200%, and several OEMs — Samsung notably — ship
above 100% out of the box on some devices. At 130% the following are at risk:

- the tab bar, which has a fixed `TAB_BAR_HEIGHT` (`src/theme/layout.js`)
- pill chips such as the scope selector and the citation chips in `Bubble`,
  which are sized by padding around one line
- the streak badge and unit-code rows, laid out `flex-row` with `numberOfLines={1}`

None of this is hypothetical on the low-end Android hardware this app is aimed
at.

**Fix:** cap scaling on *chrome* — tab labels, chips, badges, buttons — with
`maxFontSizeMultiplier={1.2}`, and deliberately allow full scaling on *content*:
the tutor's answers, note bodies, and question text. A student who has set large
text wants it on the reading, not on the furniture. Setting a default on the
shared `Text` usage is the tidy way in.

**Backend touch:** none.

---

## 8. Onboarding ends with an empty app and no first win

**Severity: medium. Directly affects activation.**

Intake finishes in `app/onboarding.jsx:104` by calling `completeOnboarding` and
letting the session guard drop the student into the tabs — which means the
**calendar**, empty, because they have not filed anything or added a deadline
yet.

The app's whole claim is *"the AI that actually did your readings"*
(`app/login.jsx`). That claim is unprovable until a student has both filed
something **and** asked about it. Right now, nothing walks them across those two
steps; they land on an empty month view and have to work out what to do.

The Study tab's empty state does the right thing — *"Drop a note into Knowledge
and I'll revise it with you"* — but they have to find that tab first.

**Fix, cheapest to most involved:**

- Route to **Knowledge** after intake rather than to Home, with the add sheet
  already open on the unit they just created. One line, and it puts the next
  action under their thumb.
- After the first material is filed, offer a suggested question about it
  (*"Ask: summarise this in five points"*) as a tappable chip on the Study
  empty state. This is the moment the product proves itself, and it should not
  depend on the student inventing a good first question.

**Backend touch:** none for either. A server-suggested question based on
retrieved content would be better still, but the static version captures most of
the value.

---

## 9. No offline pre-emption on write actions

**Severity: low-medium.**

`OFFLINE` exists in `src/api/client.js` and `Notice` styles it distinctly
(`src/components/Notice.jsx:39`) — so the app can *say* "you are offline"
well. What it does not do is know before trying.

Pressing **File it** or **Continue** with no connection means waiting out a
request timeout to be told what the radio already knew. On the connections this
app is written for, that is a recurring several-second dead wait.

**Fix:** the app already carries enough signal to do this without a new
dependency — the last sync outcome plus the last request failure is a decent
proxy. `@react-native-community/netinfo` would do it properly and is the more
honest answer if you want a reliable indicator.

**Backend touch:** none.

---

## 10. A failed answer cannot be retried in place

**Severity: low.**

When the tutor fails, `study.jsx` sets `failure` and shows a `Notice` with the
message. The student's question is already in the thread; the answer never
arrives. To try again they retype it, or scroll up and copy it.

**Fix:** a *"Try again"* action on the failure notice that re-sends the last
question, reusing the same `answerMessageId` so nothing duplicates on the next
sync. The ids are already minted client-side for exactly this kind of
idempotency (`study.jsx:225`).

**Backend touch:** worth confirming the server tolerates the same
`answer_message_id` arriving twice — it is designed to, per the comment in
`src/lib/tutor.js`, but a retry path makes that a guarantee rather than an
accident.

---

## Suggested order

Grouped by return on the time spent.

**First — a week, high visible return**

1. Markdown rendering in `Bubble` (#1)
2. Stop button on a streaming answer (#2)
3. Pull-to-refresh on `Screen` (#4)
4. Onboarding routes to Knowledge with a suggested first question (#8)

**Second — a week, mostly invisible until it saves you**

5. Local search over Knowledge and chats (#3)
6. Sync status strip with manual retry (#5)
7. Font-scaling caps on chrome (#7)

**Third — worth doing before the user base grows**

8. Undo on unit and material deletion (#6)
9. Offline pre-emption (#9)
10. Retry on a failed answer (#10)

Nothing here requires backend work to *start*. The only items that touch the
server are optional improvements to fixes that already work without them: the
tutor's system prompt (#1, only if you choose the worse path), disconnect
handling for cost (#2), and idempotency confirmation for retries (#10).

---

## Not included, deliberately

- **Visual restyling.** The design system is coherent and the type scale is
  disciplined. Changing it would be taste, not improvement.
- **Anything backend.** Payment idempotency, webhook verification, token
  storage and rate-limit handling are real and separately tracked.
- **`ARCHITECTURE.md`.** It documents a different application entirely — a
  ride-tracking app called Dash on Supabase and Render. Not a UX issue, but it
  will mislead anyone who reads it.
