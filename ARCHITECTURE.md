# Dash — backend architecture

How Dash splits across Supabase and Render, how it stays usable with no signal, and
where the speed comes from.

---

## 0. The decision that shapes everything else

**The device is the source of truth for the UI. The server is durable storage and a
sync target — never something the app waits for.**

Dash is used underground, in Nairobi traffic, on cheap Android phones with patchy data.
If starting a trip needs a round trip to Frankfurt, the app is broken in exactly the
situation it was built for. So the core loop — start trip → end trip → enter fare → see
stats — must complete with the radio off.

A second rule falls out of the first:

**Derive, don't sync.** Stats, badges, streaks and the Wrapped preview are all pure
functions of `rides` + `profile`. They are computed on device, every time, from local
data. They are never stored as syncable state.

That one rule buys three things at once:

- **Speed.** Stats render from a local SQLite query. No network in the read path, ever.
- **No conflicts.** You cannot get a conflicting badge count if nobody writes badge
  counts. Only rides and profile sync, and rides are append-only.
- **Less to build.** No aggregate invalidation, no cache coherence, no "why does the
  server think I have 7 badges".

The only thing that survives on the server as a derived artefact is the **finished
Wrapped**, because it needs a shareable image and must not change after you post it.

---

## 1. The split

### Supabase owns the request path

Everything the app touches directly, because it's a managed edge API with row-level
security — putting a server in front of it would add a hop and a failure domain for
nothing.

| Concern | How |
| --- | --- |
| **Auth** | Supabase Auth. Google OAuth + phone OTP, both native. Issues the JWT that RLS reads. |
| **Database** | Postgres. `profiles`, `rides`, `devices`, `wrapped_years`, `deletion_requests`. |
| **Authorization** | Row Level Security — `user_id = auth.uid()` on every table. This is *the* security boundary, not application code. |
| **Sync API** | PostgREST, straight from the app. No custom endpoint (see §2). |
| **Avatars** | Supabase Storage, private bucket, signed URLs. Closes the current "avatar is an in-memory URI" gap. |
| **Privileged actions** | Edge Functions for the few things needing the service role: `delete-account`, `request-export`. |
| **Housekeeping** | `pg_cron` for cheap periodic SQL — expiring stale deletion requests, nightly integrity checks. |

### Render owns everything asynchronous

Work that can't finish inside one HTTP request, needs retries, or walks every user.
Supabase Edge Functions have a hard execution ceiling; any job that iterates the whole
user table will hit it. That's the dividing line.

| Service | Type | Why it can't live in Supabase |
| --- | --- | --- |
| **Wrapped generator** | Cron Job (Dec) + on-demand worker | Walks every user, computes the year, renders a share card to Storage. Minutes, not seconds. |
| **Push notifications** | Background Worker + queue | Expo Push batches 100/request, then you poll receipts and retire dead tokens. Needs retries and a queue. |
| **Export & deletion pipeline** | Background Worker | Zips a user's history, uploads it, emails a signed link. Backs the 30-day promise in the privacy policy. |
| **Website form intake** | Web Service (small) | When `delete-account.html` / `delete-data.html` stop using `mailto:` and POST for real. Rate-limited, writes `deletion_requests`. |
| **Custom SMS sender** | Web Service | Only if you use Africa's Talking instead of Twilio — Supabase's send-SMS auth hook calls out to it. Likely much cheaper per Kenyan SMS. |
| **Queue + rate limits** | Render Key Value | Backs the workers above. |

### Two hard rules for Render

1. **Nothing the mobile app blocks on runs here.** Every Render service is either a
   cron job, a queue consumer, or called by Supabase — never by the phone in a user
   flow. This means Render being slow, cold or down is invisible to users.
2. **No free-tier web service on any path that matters.** Free Render services spin
   down when idle and cold-start slowly. Fine for the website form endpoint. Never for
   the SMS hook, which sits in the sign-in flow — that one must be a paid always-on
   instance, or you use Twilio and skip it.

---

## 2. What deliberately does *not* go on Render

Worth writing down, because these are the reflexive choices that cost you later.

- **A custom sync/REST API.** The instinct is to put Express in front of Postgres. Don't.
  RLS already enforces per-user access, PostgREST already does bulk upsert, and a Render
  hop adds latency plus another thing to keep up. The app talks to Supabase directly.
- **Auth.** No custom JWT issuing, no session server. Supabase Auth owns identity.
- **Stats and aggregation.** Computed on device (§0). Nothing to serve.
- **Image resizing on the request path.** Resize on the device before upload; the phone
  has the CPU and it saves the user's bundle.

---

## 3. Data model and sync

### Tables (server)

```sql
profiles       id uuid PK → auth.users, name, email, phone, home_city,
               avatar_path, currency, motion_detection, updated_at

rides          id uuid PK (client-generated), user_id, vehicle_type,
               start_time, duration_min, distance_km, fare,
               created_at, updated_at, deleted_at

devices        id, user_id, expo_push_token, platform, last_seen_at

wrapped_years  user_id, year, payload jsonb, card_path, generated_at

deletion_requests  id, identifier, scope, requested_at, completed_at
```

RLS on all of them: `user_id = auth.uid()`. `deletion_requests` is insert-only for
anon (it's fed by a public web form), readable only by the service role.

Index that matters: `rides (user_id, start_time desc)`.

### Local (expo-sqlite 16.x, already compatible with SDK 54)

Same `rides` / `profile` / `settings` shape, plus:

```sql
outbox   id, table_name, row_id, op, payload jsonb, created_at, attempts
meta     last_pulled_at
```

### The sync protocol

**Push.** Every mutation writes SQLite *and* appends to `outbox`, in one transaction.
A worker drains the outbox whenever the network is up:

```
POST /rest/v1/rides
Prefer: resolution=merge-duplicates
[ ...batch of rides... ]
```

Rides carry a **client-generated UUID**, so this upsert is idempotent — retry it as many
times as you like. That's what makes "no signal for three days" a non-event.

**Pull.** Cursor on `updated_at > last_pulled_at`, paged. Merge into SQLite.

**Conflicts.** Barely exist by construction:

| Data | Rule | Why it's safe |
| --- | --- | --- |
| Rides | Append-only, immutable, UUID PK | Two devices can't write the same ride |
| Ride deletion | Soft delete via `deleted_at` | Tombstone syncs like any other field |
| Profile / settings | Last-write-wins on `updated_at` | Single-user data; last edit is the intent |
| Stats, badges, streak | **Never synced** | Recomputed locally from rides |

**Sync triggers:** app foreground, connectivity regained (`netinfo`), debounced after a
mutation, and a periodic tick. Never on a screen transition, never blocking.

---

## 4. Offline behaviour

The useful thing to know: **GPS works without a data connection.** Location is a radio
receiver, not a network call. So distance tracking keeps working underground — only the
map *tiles* need signal.

| Feature | No connection |
| --- | --- |
| Start / end a trip | **Works** |
| Pick vehicle, enter fare | **Works** |
| Distance and duration | **Works** — GPS needs no data |
| Trips list, full history | **Works** — local SQLite |
| Stats, charts, period filter | **Works** — derived locally |
| Badges and streak | **Works** — derived locally |
| Wrapped (current year, in-app) | **Works** — derived locally |
| Live map tiles | Degrades to a neutral canvas, beacon still moves |
| Avatar upload | Queued, uploads on reconnect |
| First sign-in | **Blocked** — needs network once, then the session persists |
| Wrapped share card | Needs network — it's server-rendered |

Only two things genuinely require a connection, and one of them is once per install.

---

## 5. Where the speed comes from

In rough order of how much each is worth:

1. **No network in the read path.** Every screen reads local SQLite. This is worth more
   than every other item combined.
2. **Nothing user-facing on Render.** Cold starts can't touch a user flow if no user
   flow goes there.
3. **Supabase region close to Nairobi.** `eu-central-1` (Frankfurt) is the safe default
   for East Africa; `ap-south-1` (Mumbai) is worth measuring against it before you
   commit — the region can't be changed later without a migration.
4. **Sync off the interaction path.** Debounced, batched, in the background. The UI
   never shows a spinner for it.
5. **Hydrate Zustand from SQLite once at boot**, keep the working set in memory.
6. **Resize avatars on device** before upload — smaller upload, smaller download, no
   server-side image pipeline.

---

## 6. Suggested order

You don't need Render on day one. The first job that genuinely needs it is Wrapped, in
December.

| Phase | Work |
| --- | --- |
| **1. Local-first** | expo-sqlite + outbox. No backend at all yet. The app becomes fast and offline-capable on its own. |
| **2. Supabase auth** | Replace the placeholder sign-in. Google + phone OTP. Session persists. |
| **3. Supabase sync** | `profiles` + `rides` tables, RLS, drain the outbox, pull cursor. History now survives a new phone. |
| **4. Storage** | Avatars in a private bucket — fixes the in-memory URI. |
| **5. Edge Functions** | Real `delete-account`, backing the promise on the website. |
| **6. Render** | Wrapped generator first, then push, then the export pipeline. |

Phases 1–2 are independent — phase 1 is worth doing whatever happens to the backend.

---

## 7. Decisions still open

- **Supabase region** — Frankfurt vs Mumbai. Measure from a Nairobi connection before
  committing; it's a one-way door.
- **SMS provider** — Twilio (native, no Render service, pricier per Kenyan SMS) vs
  Africa's Talking (cheaper, needs an always-on Render web service as the auth hook).
  This single choice decides whether Render sits in your sign-in path.
- **Route names.** `wrapped.jsx` promises a "busiest route", but rides currently store no
  origin/destination. Either capture start/end place names, or derive from GPS endpoints
  and reverse-geocode — which has real privacy implications and would change the privacy
  policy's claim that Dash "does not build a place history".
- **Retention claims.** The privacy policy promises backup purge within 30 days. Confirm
  Supabase's backup retention on your plan actually allows that before launch.
