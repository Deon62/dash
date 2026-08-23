import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { newId } from "@/lib/ids";
import { dayKey } from "@/lib/dates";
import { rollUsage, newSubscription } from "@/lib/quota";
import { ALWAYS_SHOW_INTRO } from "@/lib/devFlags";
import { SubscriptionTier } from "@/theme/plans";

/**
 * The whole app's state, on the device.
 *
 * There is no server yet, so this *is* the source of truth: units, timetable,
 * knowledge, events and chats all live here and are written straight through to
 * AsyncStorage. Everything time-shaped is stored as an ISO string rather than a
 * Date, because a Date does not survive the JSON round-trip persistence does.
 */

const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: null,
  initials: "",
  avatarUri: null,
  /** University or college. */
  institution: "",
  /** Degree programme, e.g. "BSc Computer Science". */
  program: "",
  /** 1-6. */
  yearOfStudy: null,
  /** 1 or 2. */
  semester: null,
  memberSince: String(new Date().getFullYear()),
};

const EMPTY_SETTINGS = {
  deadlineReminders: true,
  classReminders: true,
  /** Ask for a fingerprint or face before opening the app. */
  biometricLock: false,
};

/**
 * Counters the plan limits are measured against.
 *
 * Each carries the period it belongs to, so a stale counter can be recognised
 * and reset rather than silently spending yesterday's allowance. `quizzesEver`
 * has no period on purpose — the trial's quiz limit is a lifetime one.
 */
const EMPTY_USAGE = {
  day: dayKey(),
  aiQueriesToday: 0,
  week: null,
  quizzesThisWeek: 0,
  month: dayKey().slice(0, 7),
  ocrPagesThisMonth: 0,
  quizzesEver: 0,
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
  userId: null,
  isAuthenticated: false,
  profile: { ...EMPTY_PROFILE },
  settings: { ...EMPTY_SETTINGS },
  /** `null` until the trial is started, which happens at the end of intake. */
  subscription: null,
  /**
   * The Friends plan, once there is one.
   *
   * `{ inviteCode, seats, members: [{ id, name, isOwner }] }`. Held locally so
   * the invite screen renders offline; the server is the authority on who
   * actually holds a seat, and a pull overwrites this wholesale.
   */
  group: null,
  usage: { ...EMPTY_USAGE },
  /** The three explainer screens, shown once on the very first launch. */
  introSeen: false,
  onboarded: false,
  units: [],
  classes: [],
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
};

export const useStudyStore = create(
  persist(
    (set, get) => ({
      ...BLANK,

      /**
       * False until AsyncStorage has been read back. The route guard waits on
       * it — redirecting before the stored session is known would bounce a
       * signed-in student out to /login on every cold start.
       */
      hydrated: false,

      // --- Session ----------------------------------------------------------

      /**
       * Signs the student in locally. Called once the code passes; there is no
       * token because there is no server to issue one.
       */
      signIn: (phone) =>
        set((state) => ({
          userId: state.userId ?? newId(),
          isAuthenticated: true,
          profile: { ...state.profile, phone: phone ?? state.profile.phone },
        })),

      /** Google, also local for now. Carries an email instead of a number. */
      signInWithEmail: (email) =>
        set((state) => ({
          userId: state.userId ?? newId(),
          isAuthenticated: true,
          profile: { ...state.profile, email: email ?? state.profile.email },
        })),

      /**
       * Signs out but keeps the coursework.
       *
       * Everything is local, so wiping it here would destroy a semester of
       * notes on what a student thinks of as "log out". `resetEverything` is
       * the deliberate version of that.
       */
      signOut: () => set({ isAuthenticated: false }),

      /** Dismisses the explainer. Never shown again, even after a sign-out. */
      completeIntro: () => set({ introSeen: true }),

      resetEverything: () => set({ ...BLANK, hydrated: true }),

      // --- Profile ----------------------------------------------------------

      updateProfile: (patch) =>
        set((state) => {
          const profile = { ...state.profile, ...patch };
          if (patch.name !== undefined) profile.initials = initialsFrom(profile.name);
          return { profile };
        }),

      setAvatar: (avatarUri) =>
        set((state) => ({ profile: { ...state.profile, avatarUri } })),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      // --- Subscription -----------------------------------------------------

      /** Starts the seven days. Never restarts one that has already run. */
      startTrial: () =>
        set((state) =>
          state.subscription
            ? {}
            : { subscription: newSubscription(SubscriptionTier.TRIAL) }
        ),

      /**
       * Switches the account onto a paid tier.
       *
       * Called after the student returns from Paystack saying they paid. The
       * subscription it writes is marked unverified, because nothing on this
       * device saw the money — only a server receiving Paystack's webhook can
       * set that straight, and until one exists this is a claim, not a fact.
       */
      activatePlan: (tier) => set({ subscription: newSubscription(tier) }),

      /** Replaces the local copy of the group with whatever the server said. */
      setGroup: (group) => set({ group }),

      /**
       * Adds someone optimistically, so the list moves the moment you invite.
       *
       * Reconciled on the next sync — a seat the server refused disappears
       * again, which is the right way round: showing a friend as joined and
       * being wrong is recoverable, refusing to show them until a round trip
       * completes is just a slow app.
       */
      addGroupMember: (member) =>
        set((state) => {
          if (!state.group) return {};
          const members = state.group.members ?? [];
          if (members.some((existing) => existing.id === member.id)) return {};
          return { group: { ...state.group, members: [...members, member] } };
        }),

      removeGroupMember: (memberId) =>
        set((state) =>
          state.group
            ? {
                group: {
                  ...state.group,
                  members: (state.group.members ?? []).filter(
                    (member) => member.id !== memberId
                  ),
                },
              }
            : {}
        ),

      // --- Usage ------------------------------------------------------------

      /** Rolls any counter whose period has passed. Safe to call on render. */
      refreshUsage: () => set((state) => ({ usage: rollUsage(state.usage) })),

      recordAiQuery: () =>
        set((state) => {
          const usage = rollUsage(state.usage);
          return { usage: { ...usage, aiQueriesToday: usage.aiQueriesToday + 1 } };
        }),

      recordQuiz: () =>
        set((state) => {
          const usage = rollUsage(state.usage);
          return {
            usage: {
              ...usage,
              quizzesThisWeek: usage.quizzesThisWeek + 1,
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

      /** Marks the intake flow done; the guard stops redirecting after this. */
      completeOnboarding: (patch = {}) =>
        set((state) => ({
          onboarded: true,
          // The clock starts when the account is actually usable, not on
          // install — otherwise a student who abandons intake loses days of a
          // trial they never began.
          subscription: state.subscription ?? newSubscription(SubscriptionTier.TRIAL),
          profile: {
            ...state.profile,
            ...patch,
            initials: initialsFrom(patch.name ?? state.profile.name),
          },
        })),

      // --- Units ------------------------------------------------------------

      addUnit: ({ code, title, lecturer = "" }) => {
        const unit = {
          id: newId(),
          code: code.trim().toUpperCase(),
          title: title.trim(),
          lecturer: lecturer.trim(),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ units: [...state.units, unit] }));
        return unit;
      },

      updateUnit: (id, patch) =>
        set((state) => ({
          units: state.units.map((unit) =>
            unit.id === id ? { ...unit, ...patch } : unit
          ),
        })),

      /** Drops the unit and everything filed under it — nothing is left orphaned. */
      removeUnit: (id) =>
        set((state) => ({
          units: state.units.filter((unit) => unit.id !== id),
          classes: state.classes.filter((entry) => entry.unitId !== id),
          materials: state.materials.filter((entry) => entry.unitId !== id),
          events: state.events.filter((entry) => entry.unitId !== id),
        })),

      // --- Timetable --------------------------------------------------------

      /** `{ unitId, day: 0-6, start: "08:00", end: "10:00", room }` */
      addClass: (entry) =>
        set((state) => ({
          classes: [...state.classes, { id: newId(), ...entry }],
        })),

      removeClass: (id) =>
        set((state) => ({ classes: state.classes.filter((c) => c.id !== id) })),

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
          addedAt: new Date().toISOString(),
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
            material.id === id ? { ...material, archived } : material
          ),
        })),

      removeMaterial: (id) =>
        set((state) => ({
          materials: state.materials.filter((m) => m.id !== id),
        })),

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
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ events: [...state.events, event] }));
        return event;
      },

      toggleEvent: (id) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id ? { ...event, done: !event.done } : event
          ),
        })),

      removeEvent: (id) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

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
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ chats: [chat, ...state.chats], activeChatId: chat.id }));
        return chat;
      },

      selectChat: (activeChatId) => set({ activeChatId }),

      setChatUnit: (id, unitId) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === id ? { ...chat, unitId } : chat
          ),
        })),

      /** `{ role: "student" | "tutor", text, sources }` */
      appendMessage: (id, message) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== id) return chat;

            const messages = [
              ...chat.messages,
              { id: newId(), at: new Date().toISOString(), ...message },
            ];

            return {
              ...chat,
              messages,
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
      name: "study-brain-v1",
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` is about this launch, not about the student — persisting it
      // would restore `true` before the read had actually happened.
      //
      // While the intro is being designed, `introSeen` is left out too, so it
      // comes back false on every cold start and the screens show again. The
      // flag still works normally within a session; it just is not remembered.
      partialize: ({ hydrated, introSeen, ...rest }) =>
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
