import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { newId } from "@/lib/ids";
import { dayKey } from "@/lib/dates";

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

const EMPTY_BILLING = {
  plan: "free",
  /** Safaricom number for M-Pesa, in local format. */
  mpesaNumber: "",
  /** Paystack handles the card itself; this is only what it hands back. */
  cardLast4: "",
  cardBrand: "",
};

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
  billing: { ...EMPTY_BILLING },
  onboarded: false,
  units: [],
  classes: [],
  materials: [],
  events: [],
  chats: [],
  activeChatId: null,
  study: { streakDays: 0, lastStudyDay: null, questionsAsked: 0 },
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

      updateBilling: (patch) =>
        set((state) => ({ billing: { ...state.billing, ...patch } })),

      /** Marks the intake flow done; the guard stops redirecting after this. */
      completeOnboarding: (patch = {}) =>
        set((state) => ({
          onboarded: true,
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
      addEvent: ({ unitId = null, title, at, kind = "assignment" }) => {
        const event = {
          id: newId(),
          unitId,
          title: title.trim(),
          at,
          kind,
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
          const { lastStudyDay, streakDays, questionsAsked } = state.study;

          if (lastStudyDay === today) {
            return { study: { ...state.study, questionsAsked: questionsAsked + 1 } };
          }

          const yesterday = dayKey(Date.now() - 86400000);

          return {
            study: {
              streakDays: lastStudyDay === yesterday ? streakDays + 1 : 1,
              lastStudyDay: today,
              questionsAsked: questionsAsked + 1,
            },
          };
        }),
    }),
    {
      name: "study-brain-v1",
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` is about this launch, not about the student — persisting it
      // would restore `true` before the read had actually happened.
      partialize: ({ hydrated, ...rest }) => rest,
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
