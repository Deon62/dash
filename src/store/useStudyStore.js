import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { newId } from "@/lib/ids";
import { dayKey } from "@/lib/dates";
import { rollUsage } from "@/lib/quota";
import { ALWAYS_SHOW_INTRO } from "@/lib/devFlags";

/**
 * The app's state, backed by the account.
 *
 * The server at `EXPO_PUBLIC_API_URL` is the source of truth. What is written
 * here is a cache of it, so a student on a train still sees their notes, plus
 * an outbox: a row the device writes is marked `dirty`, a deletion leaves a
 * tombstone, and `src/lib/sync.js` pushes both before pulling back what the
 * server has.
 *
 * Everything time-shaped is an ISO string rather than a Date, because a Date
 * does not survive the JSON round-trip persistence does.
 */

/**
 * The AsyncStorage key everything below is persisted under.
 *
 * Exported because `ErrorBoundary` clears it as the last way out of a crash
 * loop, and a second copy of this string in that file would be a way for the
 * two to drift — leaving a button that promises to clear the state and quietly
 * clears nothing.
 */
export const STORE_KEY = "study-brain-v1";

/** Stamped on every row the device writes. This is what resolves conflicts. */
const stamp = () => new Date().toISOString();

/**
 * What every local write puts on a row.
 *
 * `dirty` is a flag rather than a timestamp comparison, and that is the whole
 * point. Deciding "has the server got this yet" by testing `updatedAt` against
 * the moment of the last push sounds equivalent and is not: phone clocks drift,
 * and a row that arrived from another device carries *that* device's clock. One
 * skewed clock and rows that synced days ago still read as unsent — permanently,
 * because no later push can move past a timestamp already in the future.
 *
 * A flag that the push itself clears cannot be wrong about that.
 */
const touched = () => ({ updatedAt: stamp(), dirty: true });

const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: null,
  initials: "",
  /**
   * What an `<Image>` can load: a signed URL that expires, or the local file
   * while an upload is still in flight. Not durable, and not the truth.
   */
  avatarUri: null,
  /**
   * When that URL stops working, as epoch ms — or null for a local file.
   *
   * Kept so a launch does not sign a new URL for a photo that has not changed.
   * A freshly signed URL is a *different* URL, so the image cache misses and
   * the same photo is downloaded again on every cold start and every return
   * from the background. Holding the URL until it actually expires is what
   * turns that into one download.
   */
  avatarUriExpiresAt: null,
  /**
   * The object in the `avatars` bucket. This is what the server stores and
   * what survives a sign-out, and `avatarUri` is re-signed from it on load.
   * Keeping only the URL is what made the photo vanish: a stored link expires.
   */
  avatarPath: null,
  /** University or college. */
  institution: "",
  /** Degree programme, e.g. "BSc Computer Science". */
  program: "",
  /** 1-6. */
  yearOfStudy: null,
  /** 1-3. Trimester programmes are common at postgraduate level. */
  semester: null,
  memberSince: String(new Date().getFullYear()),
};

const EMPTY_SETTINGS = {
  deadlineReminders: true,
  sessionReminders: true,
  /** Ask for a fingerprint or face before opening the app. */
  biometricLock: false,
};

/**
 * Counters the plan limits are measured against.
 *
 * One period, `month`, for all three metered counters: everything refills on
 * the 1st, so a single stale month is what marks the lot for reset rather than
 * silently spending last month's allowance. `quizzesEver` and `aiQueriesEver`
 * have no period on purpose — the free plan's ceilings on both are lifetime
 * ones, and a counter that rolled over would be no ceiling at all.
 */
const EMPTY_USAGE = {
  month: dayKey().slice(0, 7),
  aiQueriesThisMonth: 0,
  quizzesThisMonth: 0,
  ocrPagesThisMonth: 0,
  /** No period. The free plan's ceiling is a lifetime one. */
  aiQueriesEver: 0,
  quizzesEver: 0,
};

/**
 * Empty tombstones, one list per synced table.
 *
 * A deleted row cannot simply vanish: the server would still hold it, and the
 * next pull would put it straight back. The id and the moment it was deleted
 * are kept until a push has carried them across — along with the parent unit,
 * because the server validates a burial against the same schema as a live row
 * and one arriving without a `unit_id` would either be refused or point the
 * row at nothing.
 */
const EMPTY_TOMBSTONES = {
  units: [],
  sessions: [],
  materials: [],
  events: [],
  chats: [],
};

/** How much streak history is worth keeping: a week to draw, a month of slack. */
const STREAK_HISTORY_DAYS = 60;

function initialsFrom(name) {
  return (
    (name ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || ""
  );
}

const BLANK = {
  /** The server's id for this account, from the token response. */
  userId: null,
  isAuthenticated: false,
  profile: { ...EMPTY_PROFILE },
  settings: { ...EMPTY_SETTINGS },
  /**
   * `null` until the server has been asked. Absent is not the same as free:
   * the server always answers with a plan, so nothing here has to guess.
   */
  subscription: null,
  /**
   * The Friends plan, once there is one.
   *
   * `{ id, inviteCode, seats, seatsTaken, members: [{ id, name, isOwner, isMe }] }`.
   * Cached so the invite screen renders with no connection; the server is the
   * authority on who holds a seat, and `loadGroup` replaces this wholesale.
   */
  group: null,
  /**
   * The referral code and its counts, as `/me/referrals` last reported them.
   *
   * Cached because the code is minted once and never changes: re-reading it to
   * draw the same six characters is a request that can only ever return what
   * is already on screen. The counts move rarely and slowly — a friend has to
   * subscribe, and the reward waits out a hold — so the screen renders from
   * here and revalidates behind it. `null` until it has ever been read.
   */
  referral: null,
  usage: { ...EMPTY_USAGE },
  /** The three explainer screens, shown once on the very first launch. */
  introSeen: false,
  onboarded: false,
  units: [],
  sessions: [],
  materials: [],
  events: [],
  chats: [],
  activeChatId: null,
  study: {
    streakDays: 0,
    /** Best run ever, kept when the current one breaks. */
    longestStreak: 0,
    lastStudyDay: null,
    questionsAsked: 0,
    /**
     * Day keys the student actually revised on, newest last.
     *
     * Capped, because the streak screen only ever draws a week and nothing
     * reads further back — an uncapped list would grow for the life of the
     * install to answer a question about the last seven days.
     */
    days: [],
  },

  // --- Session ------------------------------------------------------------

  /**
   * The server's access token, or null.
   *
   * Kept out of `profile` because it is a credential, not a preference: it is
   * the thing to clear on sign-out and the thing never to log.
   */
  authToken: null,
  /** Swapped for a new pair when the access token expires. Rotated each time. */
  refreshToken: null,
  /** Epoch milliseconds. Refreshed a little before this, never after. */
  tokenExpiresAt: null,

  // --- Sync ---------------------------------------------------------------

  /**
   * The server's cursor from the last successful pull, handed back as `since`
   * on the next one so a pull carries changes rather than the whole account.
   */
  syncCursor: null,
  /** When the last push succeeded. Shown, not used to decide what to send. */
  pushedAt: null,
  tombstones: { ...EMPTY_TOMBSTONES },
  /** Whether a sync is in flight, so two cannot overlap and duplicate a push. */
  syncing: false,
  /** The last sync failure, in words for a student, or null. */
  syncError: null,

  /**
   * The meters, as the server counts them.
   *
   * `usage` above is the device's own tally and exists so a limit can be
   * refused before a request is made. This is the authority, and the Usage
   * screen draws from it whenever it is present.
   */
  serverUsage: null,
};

export const useStudyStore = create(
  persist(
    (set, get) => ({
      ...BLANK,

      /**
       * This installation, minted once and kept for good.
       *
       * Deliberately outside `BLANK` so signing out does not mint a new one:
       * the server allows one live session per account and identifies the
       * handset by this id, so a device that changes identity on every sign-in
       * grows a row per launch and can never be signed out remotely.
       */
      deviceId: null,

      /**
       * False until AsyncStorage has been read back. The route guard waits on
       * it — redirecting before the stored session is known would bounce a
       * signed-in student out to /login on every cold start.
       */
      hydrated: false,

      // --- Session ----------------------------------------------------------

      /** Minted on first use and never again. See `deviceId` above. */
      ensureDeviceId: () => {
        const existing = get().deviceId;
        if (existing) return existing;
        const deviceId = newId();
        set({ deviceId });
        return deviceId;
      },

      /**
       * Records a real session: the account the server issued tokens for.
       *
       * `userId` comes from the server rather than being minted here, because
       * every row this device pushes is filed against it — an id invented on
       * the phone would file a semester of notes under an account that does
       * not exist.
       */
      setSession: ({ userId, accessToken, refreshToken, expiresIn }) =>
        set({
          userId: userId ?? get().userId,
          isAuthenticated: true,
          authToken: accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          // A minute of slack, so a token that expires mid-flight is refreshed
          // before the request rather than after it comes back 401.
          tokenExpiresAt: expiresIn ? Date.now() + (expiresIn - 60) * 1000 : null,
        }),

      /** Called by the refresh path in `src/lib/session.js`, nowhere else. */
      setTokens: ({ accessToken, refreshToken, expiresIn }) =>
        set({
          authToken: accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          tokenExpiresAt: expiresIn ? Date.now() + (expiresIn - 60) * 1000 : null,
        }),

      /** Dismisses the explainer. Never shown again, even after a sign-out. */
      completeIntro: () => set({ introSeen: true }),

      /**
       * Signs out and clears the cache with it.
       *
       * The coursework is on the account, not on the handset, so there is
       * nothing here to lose — and leaving one student's notes on a phone the
       * next student signs into would be the wrong way round. Signing back in
       * pulls it all down again.
       */
      signOut: () =>
        set({
          ...BLANK,
          hydrated: true,
          // The explainer has been seen; showing it again after a sign-out
          // would be a stranger's welcome for a returning student.
          introSeen: get().introSeen,
        }),

      /** After the server has deleted the account. Same wipe, different cause. */
      resetEverything: () => set({ ...BLANK, hydrated: true }),

      // --- Sync bookkeeping ---------------------------------------------------

      setSyncing: (syncing) => set({ syncing }),
      setSyncError: (syncError) => set({ syncError }),

      /**
       * Clears the outbox for exactly what a push carried.
       *
       * Matched on id *and* version, not wholesale. A note edited while the
       * request was in flight is a different row from the one that went, and
       * clearing it by id alone would drop that edit — the note would appear
       * to save and then quietly un-save itself. Comparing `updatedAt` against
       * the version that was actually sent leaves the newer one dirty, so it
       * goes with the next push.
       */
      markPushed: (sent) =>
        set((state) => {
          const clean = (rows, versions) =>
            versions?.size
              ? rows.map((row) =>
                  versions.get(row.id) === row.updatedAt
                    ? { ...row, dirty: false }
                    : row,
                )
              : rows;

          const buried = (rows, ids) =>
            ids?.size ? rows.filter((row) => !ids.has(row.id)) : rows;

          return {
            pushedAt: stamp(),
            units: clean(state.units, sent.units),
            sessions: clean(state.sessions, sent.sessions),
            materials: clean(state.materials, sent.materials),
            events: clean(state.events, sent.events),
            chats: clean(state.chats, sent.chats),
            tombstones: {
              units: buried(state.tombstones.units, sent.graves?.units),
              sessions: buried(state.tombstones.sessions, sent.graves?.sessions),
              materials: buried(state.tombstones.materials, sent.graves?.materials),
              events: buried(state.tombstones.events, sent.graves?.events),
              chats: buried(state.tombstones.chats, sent.graves?.chats),
            },
          };
        }),

      setCursor: (syncCursor) => set({ syncCursor }),

      /** Replaces the cached tables with what a pull resolved to. */
      applyPull: (tables) => set(tables),

      /**
       * Whether intake has been done.
       *
       * Set from the server's profile rather than remembered here, because it
       * is a property of the account: a student signing in on a new phone has
       * already told us their programme, and asking again would look like the
       * first one had lost it.
       */
      setOnboarded: (onboarded) => set({ onboarded }),

      /** The profile as the server has it. Local edits are pushed, not merged. */
      applyServerProfile: (patch) =>
        set((state) => {
          const profile = { ...state.profile, ...patch };
          profile.initials = initialsFrom(profile.name);
          return { profile };
        }),

      applyServerSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      applyServerSubscription: (subscription) => set({ subscription }),

      applyServerUsage: (serverUsage) => set({ serverUsage }),

      applyServerStreak: ({ current, longest, lastDay, days }) =>
        set((state) => ({
          study: {
            ...state.study,
            streakDays: current ?? state.study.streakDays,
            longestStreak: longest ?? state.study.longestStreak,
            lastStudyDay: lastDay ?? state.study.lastStudyDay,
            days: days ?? state.study.days,
          },
        })),

      // --- Profile ----------------------------------------------------------

      updateProfile: (patch) =>
        set((state) => {
          const profile = { ...state.profile, ...patch, updatedAt: stamp() };
          if (patch.name !== undefined) profile.initials = initialsFrom(profile.name);
          return { profile };
        }),

      /**
       * Both halves of the photo, together.
       *
       * It took a bare URI once, which is precisely how the two drifted: the
       * displayable link was set and the path behind it never was, so nothing
       * on the account pointed at the file and the picture did not come back.
       */
      setAvatar: ({ avatarUri, avatarPath, avatarUriExpiresAt = null }) =>
        set((state) => ({
          profile: { ...state.profile, avatarUri, avatarPath, avatarUriExpiresAt },
        })),

      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch, updatedAt: stamp() },
        })),

      // --- Subscription -----------------------------------------------------

      /**
       * The plan, exactly as `/billing/subscription` reported it.
       *
       * Nothing on this device grants a plan any more. A payment is a fact the
       * server establishes — from Kora's webhook or from verifying the
       * reference — and the app's job is to read it, not to claim it.
       */
      setSubscription: (subscription) => set({ subscription }),

      /** The Friends group, as `/billing/group` reported it. */
      setGroup: (group) => set({ group }),

      /**
       * The referral snapshot, replaced wholesale.
       *
       * Stamped on arrival rather than trusted to be current: what decides
       * whether to ask again is how old this is, and a cache with no age is a
       * cache that either never refreshes or always does.
       */
      setReferral: (referral) =>
        set({ referral: referral ? { ...referral, readAt: Date.now() } : null }),

      // --- Usage ------------------------------------------------------------
      //
      // These count on the device so a limit can be refused before a request is
      // made — a student on a dead connection should still be told they are out
      // of questions rather than watching one fail. The server meters the same
      // things and wins whenever `serverUsage` is present.

      /** Rolls any counter whose period has passed. Safe to call on render. */
      refreshUsage: () => set((state) => ({ usage: rollUsage(state.usage) })),

      recordAiQuery: () =>
        set((state) => {
          const usage = rollUsage(state.usage);
          return {
            usage: {
              ...usage,
              aiQueriesThisMonth: usage.aiQueriesThisMonth + 1,
              // Both, always. The monthly counter alone would let the free
              // plan's lifetime ceiling be walked past a month at a time.
              aiQueriesEver: (usage.aiQueriesEver ?? 0) + 1,
            },
          };
        }),

      recordQuiz: () =>
        set((state) => {
          const usage = rollUsage(state.usage);
          return {
            usage: {
              ...usage,
              quizzesThisMonth: usage.quizzesThisMonth + 1,
              quizzesEver: usage.quizzesEver + 1,
            },
          };
        }),

      recordOcrPages: (pages) =>
        set((state) => {
          const usage = rollUsage(state.usage);
          return {
            usage: { ...usage, ocrPagesThisMonth: usage.ocrPagesThisMonth + pages },
          };
        }),

      /**
       * Marks the intake flow done; the guard stops redirecting after this.
       *
       * No plan is minted here, and there is no longer a fortnight to mint.
       * Every account is on free from the moment the server creates it, which
       * is also why nothing on this device needs a clock: there is no date to
       * restart by reinstalling.
       */
      completeOnboarding: (patch = {}) =>
        set((state) => ({
          onboarded: true,
          profile: {
            ...state.profile,
            ...patch,
            initials: initialsFrom(patch.name ?? state.profile.name),
            ...touched(),
          },
        })),

      // --- Units ------------------------------------------------------------

      addUnit: ({ code, title, lecturer = "" }) => {
        const unit = {
          id: newId(),
          code: code.trim().toUpperCase(),
          title: title.trim(),
          lecturer: lecturer.trim(),
          createdAt: stamp(),
          ...touched(),
        };

        set((state) => ({ units: [...state.units, unit] }));
        return unit;
      },

      updateUnit: (id, patch) =>
        set((state) => ({
          units: state.units.map((unit) =>
            unit.id === id ? { ...unit, ...patch, ...touched() } : unit
          ),
        })),

      /**
       * Drops the unit and everything filed under it — nothing is left
       * orphaned, on the device or on the account. Each cascade leaves its own
       * tombstone, because the server deletes what it is told to delete rather
       * than inferring a cascade from a parent row it may not have seen yet.
       */
      removeUnit: (id) =>
        set((state) => {
          const at = stamp();
          const buried = (rows) =>
            rows.map((row) => ({ id: row.id, unitId: row.unitId, deletedAt: at }));

          const sessions = state.sessions.filter((entry) => entry.unitId === id);
          const materials = state.materials.filter((entry) => entry.unitId === id);
          const events = state.events.filter((entry) => entry.unitId === id);

          return {
            units: state.units.filter((unit) => unit.id !== id),
            sessions: state.sessions.filter((entry) => entry.unitId !== id),
            materials: state.materials.filter((entry) => entry.unitId !== id),
            events: state.events.filter((entry) => entry.unitId !== id),
            tombstones: {
              ...state.tombstones,
              units: [...state.tombstones.units, { id, deletedAt: at }],
              sessions: [...state.tombstones.sessions, ...buried(sessions)],
              materials: [...state.tombstones.materials, ...buried(materials)],
              events: [...state.tombstones.events, ...buried(events)],
            },
          };
        }),

      // --- Timetable --------------------------------------------------------

      /** `{ unitId, day: 0-6, start: "08:00", end: "10:00", room }` */
      addSession: (entry) =>
        set((state) => ({
          sessions: [...state.sessions, { id: newId(), ...entry, ...touched() }],
        })),

      removeSession: (id) =>
        set((state) => {
          const gone = state.sessions.find((entry) => entry.id === id);

          return {
            sessions: state.sessions.filter((entry) => entry.id !== id),
            tombstones: {
              ...state.tombstones,
              sessions: [
                ...state.tombstones.sessions,
                { id, unitId: gone?.unitId ?? null, deletedAt: stamp() },
              ],
            },
          };
        }),

      // --- Knowledge --------------------------------------------------------

      /**
       * Files something under a unit. `body` is the text the tutor searches;
       * `uri` points at an attached file when there is one.
       */
      addMaterial: ({ unitId, title, body = "", kind = "note", uri = null }) => {
        const material = {
          id: newId(),
          unitId,
          title: title.trim(),
          body: body.trim(),
          kind,
          uri,
          archived: false,
          addedAt: stamp(),
          ...touched(),
          /**
           * Where an attached file has got to.
           *
           * Three of these are the device's and four are the server's, and the
           * split matters because only the device's can be retried with the
           * bytes already in hand:
           *
           *  - `queued` — picked, not yet sent
           *  - `uploading` — the bytes are going
           *  - `failed` — they never left this phone. Retry sends them again.
           *  - `pending` — in the bucket, waiting for a worker
           *  - `reading` — a worker is reading it now
           *  - `ready` — indexed; the tutor can quote it
           *  - `unreadable` — read and rejected. **Terminal.** Another file
           *    might work; the same bytes never will.
           *  - `blocked` — nothing wrong with the file, the plan does not
           *    cover it. **Terminal**, and re-uploading is a loop.
           *
           * A typed note is `ready` immediately — there is nothing to carry.
           */
          uploadStatus: uri ? "queued" : "ready",
          /** The server's own words for why it is not `ready`. See `sync.js`. */
          extractionError: null,
        };

        set((state) => ({ materials: [material, ...state.materials] }));
        return material;
      },

      /**
       * Archiving rather than deleting is the default action on knowledge: a
       * student clearing last semester's clutter should not be one tap from
       * losing the notes they will want again before finals.
       */
      archiveMaterial: (id, archived = true) =>
        set((state) => ({
          materials: state.materials.map((material) =>
            material.id === id
              ? { ...material, archived, ...touched() }
              : material
          ),
        })),

      /** Patches one item in place. The upload flow uses it to move a file on. */
      updateMaterial: (id, patch) =>
        set((state) => ({
          materials: state.materials.map((material) =>
            material.id === id
              ? { ...material, ...patch, ...touched() }
              : material
          ),
        })),

      removeMaterial: (id) =>
        set((state) => {
          const gone = state.materials.find((material) => material.id === id);

          return {
            materials: state.materials.filter((material) => material.id !== id),
            tombstones: {
              ...state.tombstones,
              materials: [
                ...state.tombstones.materials,
                { id, unitId: gone?.unitId ?? null, deletedAt: stamp() },
              ],
            },
          };
        }),

      // --- Events -----------------------------------------------------------

      /**
       * Anything with a date: an assignment, a CAT, an exam, a group meeting.
       * `unitId` may be null — not everything a student has to turn up for
       * belongs to a unit.
       */
      addEvent: ({ unitId = null, title, at, kind = "assignment", label = "" }) => {
        const event = {
          id: newId(),
          unitId,
          title: title.trim(),
          at,
          kind,
          // Only `other` uses this — what the student called an activity the
          // fixed list does not have a name for.
          label: kind === "other" ? label.trim() : "",
          done: false,
          createdAt: stamp(),
          ...touched(),
        };

        set((state) => ({ events: [...state.events, event] }));
        return event;
      },

      toggleEvent: (id) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id
              ? { ...event, done: !event.done, ...touched() }
              : event
          ),
        })),

      removeEvent: (id) =>
        set((state) => {
          const gone = state.events.find((event) => event.id === id);

          return {
            events: state.events.filter((event) => event.id !== id),
            tombstones: {
              ...state.tombstones,
              events: [
                ...state.tombstones.events,
                { id, unitId: gone?.unitId ?? null, deletedAt: stamp() },
              ],
            },
          };
        }),

      // --- Chats ------------------------------------------------------------

      /**
       * Conversations, newest first, each scoped to a unit or to the whole
       * course. Kept as whole objects rather than a flat message list with a
       * foreign key because the drawer only ever needs the headers, and this
       * way reading them costs nothing.
       */
      newChat: (unitId = null) => {
        const chat = {
          id: newId(),
          title: "New chat",
          unitId,
          mode: "ask",
          messages: [],
          createdAt: stamp(),
          ...touched(),
        };

        set((state) => ({ chats: [chat, ...state.chats], activeChatId: chat.id }));
        return chat;
      },

      selectChat: (activeChatId) => set({ activeChatId }),

      setChatUnit: (id, unitId) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === id ? { ...chat, unitId, ...touched() } : chat
          ),
        })),

      /** `{ role: "student" | "tutor", text, sources }` */
      appendMessage: (id, message) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== id) return chat;

            const messages = [
              ...chat.messages,
              { id: newId(), at: stamp(), ...message },
            ];

            return {
              ...chat,
              messages,
              ...touched(),
              // The first thing asked names the conversation. A student
              // scanning the drawer recognises their own question long before
              // they recognise a date.
              title:
                chat.title === "New chat" && message.role === "student"
                  ? message.text.slice(0, 48)
                  : chat.title,
            };
          }),
        })),

      deleteChat: (id) =>
        set((state) => {
          const chats = state.chats.filter((chat) => chat.id !== id);
          return {
            chats,
            activeChatId:
              state.activeChatId === id ? (chats[0]?.id ?? null) : state.activeChatId,
            tombstones: {
              ...state.tombstones,
              chats: [...state.tombstones.chats, { id, deletedAt: stamp() }],
            },
          };
        }),

      /**
       * Counts one revision session towards the streak.
       *
       * Only the first question of the day moves it; asking twice in an evening
       * is one day of studying, not two.
       */
      recordStudy: () =>
        set((state) => {
          const today = dayKey();
          const { lastStudyDay, streakDays, longestStreak, questionsAsked, days } =
            state.study;

          if (lastStudyDay === today) {
            return {
              study: { ...state.study, questionsAsked: questionsAsked + 1 },
            };
          }

          const yesterday = dayKey(Date.now() - 86400000);
          const nextStreak = lastStudyDay === yesterday ? streakDays + 1 : 1;

          return {
            study: {
              streakDays: nextStreak,
              // A broken streak still happened. Keeping the best run is what
              // makes starting again feel like continuing rather than losing.
              longestStreak: Math.max(longestStreak ?? 0, nextStreak),
              lastStudyDay: today,
              questionsAsked: questionsAsked + 1,
              days: [...(days ?? []), today].slice(-STREAK_HISTORY_DAYS),
            },
          };
        }),

    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      /**
       * Renames and reshapes carried forward, so nobody loses a timetable to
       * vocabulary or a semester of notes to a schema change.
       *
       * v2 renamed `classes` to `sessions` — the app is for postgraduates as
       * well as undergraduates, and what they attend is as often a seminar, a
       * lab or a supervision as a class. Without this, an existing install
       * rehydrates a state with no `sessions` key and the timetable comes back
       * empty, which reads as data loss rather than a rename.
       *
       * v3 is the move onto the account. An install from before it has rows
       * with no `updatedAt` and a session with no tokens, so: every row is
       * stamped now, which marks the lot dirty and pushes a device's whole
       * history up on the first sync, and the session is cleared so the
       * student signs in for real once. Signing in is the only way to get a
       * token, and without one there is nothing to push to.
       *
       * v5 is the move from daily to monthly allowances. The old day and week
       * counters are dropped rather than converted — see the block itself.
       */
      migrate: (persisted, version) => {
        if (!persisted) return persisted;

        let state = persisted;

        if (version < 2) {
          const { classes, settings, ...rest } = state;

          state = {
            ...rest,
            sessions: classes ?? rest.sessions ?? [],
            settings: settings
              ? (({ classReminders, ...keep }) => ({
                  ...keep,
                  sessionReminders: classReminders ?? keep.sessionReminders ?? true,
                }))(settings)
              : settings,
          };
        }

        if (version < 3) {
          const at = stamp();
          const stampAll = (rows) =>
            (rows ?? []).map((row) => ({ ...row, updatedAt: row.updatedAt ?? at }));

          state = {
            ...state,
            units: stampAll(state.units),
            sessions: stampAll(state.sessions),
            materials: stampAll(state.materials),
            events: stampAll(state.events),
            chats: stampAll(state.chats),
            tombstones: { ...EMPTY_TOMBSTONES },
            syncCursor: null,
            pushedAt: null,
            // No token existed before this version, so there is no session to
            // restore — only a local sign-in flag that would now let someone
            // past the wall with nothing behind it.
            userId: null,
            isAuthenticated: false,
            authToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            subscription: null,
            serverUsage: null,
          };
        }

        if (version < 4) {
          // Before v4 an unsent row was inferred by comparing `updatedAt`
          // against the last push, which a drifting phone clock could make
          // permanently wrong. Everything is marked unsent once here: the
          // server upserts on ids the device chose, so re-sending a row it
          // already has costs one request and changes nothing.
          // `updatedAt` is also guaranteed here. It is the version a push is
          // acknowledged by, so a row missing one could never be marked clean
          // and would be re-sent for ever.
          const soil = (rows) =>
            (rows ?? []).map((row) => ({
              ...row,
              updatedAt: row.updatedAt ?? row.createdAt ?? row.addedAt ?? stamp(),
              dirty: true,
            }));

          state = {
            ...state,
            units: soil(state.units),
            sessions: soil(state.sessions),
            materials: soil(state.materials),
            events: soil(state.events),
            chats: soil(state.chats),
          };
        }

        if (version < 5) {
          // Allowances became monthly. The counters filed under a day and an
          // ISO week are simply never read again — at this version every
          // student starts a fresh month, which is a one-off giveaway of at
          // most one month's allowance and cheaper than any migration clever
          // enough to avoid it. The two lifetime counters are carried across
          // untouched: the free plan's ceilings are the numbers that actually
          // bound what a free account can cost.
          const { day, week, aiQueriesToday, quizzesThisWeek, ...usage } =
            state.usage ?? {};

          state = {
            ...state,
            usage: {
              ...EMPTY_USAGE,
              ...usage,
              month: dayKey().slice(0, 7),
              aiQueriesThisMonth: 0,
              quizzesThisMonth: 0,
              ocrPagesThisMonth: 0,
              aiQueriesEver: usage.aiQueriesEver ?? 0,
              quizzesEver: usage.quizzesEver ?? 0,
            },
            // The meters on the Usage screen are the server's, and its copy
            // still has the old field names until the deploy lands. Dropping
            // it means the screen draws from the device for one refresh
            // instead of showing a bar with no number behind it.
            serverUsage: null,
          };
        }

        return state;
      },
      // `hydrated` is about this launch, not about the student — persisting it
      // would restore `true` before the read had actually happened. `syncing`
      // and `syncError` are the same: they describe a request, and a request
      // does not survive the process that made it.
      //
      // `introSeen` is left out only while ALWAYS_SHOW_INTRO is on, so the
      // explainer comes back on every cold start while it is being designed.
      partialize: ({ hydrated, syncing, syncError, introSeen, ...rest }) =>
        ALWAYS_SHOW_INTRO ? rest : { ...rest, introSeen },
      // Flip the flag through the store rather than the callback's `state`
      // argument: on a read error that argument is undefined, and the guard
      // would then wait on a hydration that already finished, failed.
      onRehydrateStorage: () => () => useStudyStore.setState({ hydrated: true }),
    }
  )
);

// --- Selectors -------------------------------------------------------------
// Plain functions over a snapshot rather than hooks, so a screen can derive
// several views from one subscription instead of subscribing once per value.

export function unitById(units, id) {
  return units.find((unit) => unit.id === id) ?? null;
}
