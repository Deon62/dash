import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useStudyStore } from "@/store/useStudyStore";
import { registerDevice } from "@/lib/session";
import { loadProfile, loadSettings, loadStreak, loadUsage } from "@/lib/account";
import { loadGroup, loadSubscription } from "@/lib/billing";
import { retryFailedUploads } from "@/lib/materials";
import { sync } from "@/lib/sync";

/**
 * Everything the app asks the server for when it comes to life.
 *
 * One place, called from the root layout, rather than a `useEffect` per screen.
 * Scattered loads mean six screens each fetching the profile on mount, a
 * different subset of the account being fresh depending on where a student
 * happened to open the app, and no single answer to "have we caught up yet".
 */

/** How long the app has to be in the background before a return re-syncs. */
const STALE_AFTER_MS = 60000;

/**
 * How long a write waits for company before it is pushed.
 *
 * Adding four units in a row is one push, not four. Short enough that a
 * student who files a note and immediately closes the app has it on the
 * account before the process is gone.
 */
const WRITE_SETTLE_MS = 1500;

/** The tables a push carries. A change to any of them is a reason to sync. */
const SYNCED = ["units", "sessions", "materials", "events", "chats", "tombstones"];

/**
 * Brings the device level with the account.
 *
 * The order matters. Coursework goes first because it is what a student sees —
 * a timetable that fills in a second after the plan badge does is the right way
 * round. Everything after it is small, independent, and fired together rather
 * than in a chain, so one slow call does not hold up the rest.
 */
export async function refreshAccount({ full = false } = {}) {
  if (!useStudyStore.getState().isAuthenticated) return;

  await sync();

  await Promise.all([
    loadSubscription(),
    loadUsage(),
    loadStreak(),
    ...(full ? [loadProfile(), loadSettings(), loadGroup(), registerDevice()] : []),
  ]);

  // Last, and unawaited by anything that renders: a queued PDF finishing its
  // upload is not something a student is waiting on a screen for.
  retryFailedUploads();
}

/**
 * Pushes whatever was just written, once the writing stops.
 *
 * Subscribing to the store rather than calling `sync()` from twenty button
 * handlers: every screen that adds a unit, a session, a deadline or a note
 * would otherwise have to remember to, and the one that forgets produces a row
 * that exists on a phone and nowhere else until the next cold start.
 */
function useWriteSync() {
  useEffect(() => {
    let timer = null;

    const unsubscribe = useStudyStore.subscribe((state, previous) => {
      if (!state.isAuthenticated) return;

      // Reference equality per table: each one is replaced rather than mutated
      // on a write, so this is exactly "did a synced table change" — and it
      // ignores the sync flags this very function causes to move, which would
      // otherwise reschedule the push it just finished.
      const changed = SYNCED.some((table) => state[table] !== previous[table]);
      if (!changed) return;

      clearTimeout(timer);
      timer = setTimeout(() => sync(), WRITE_SETTLE_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

/**
 * Keeps the account fresh for as long as the app is open.
 *
 * Mounted once from the root layout. Three triggers: signing in, the store
 * finishing hydration on a cold start, and coming back to the foreground after
 * long enough away for something to have changed — on another device, or
 * because a payment finally cleared.
 */
export function useAccountSync() {
  useWriteSync();

  const hydrated = useStudyStore((state) => state.hydrated);
  const isAuthenticated = useStudyStore((state) => state.isAuthenticated);
  const userId = useStudyStore((state) => state.userId);

  const backgroundedAt = useRef(null);

  // Keyed on the account rather than on the flag alone, so signing in as
  // somebody else on the same handset loads their account rather than leaving
  // the previous student's on screen.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    refreshAccount({ full: true });
  }, [hydrated, isAuthenticated, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        backgroundedAt.current = Date.now();
        return;
      }

      const away = backgroundedAt.current;
      backgroundedAt.current = null;

      // A glance at a notification and straight back is not a reason to sync.
      // Long enough away that a payment could have cleared or another device
      // could have written something is.
      if (!away || Date.now() - away < STALE_AFTER_MS) return;
      if (!useStudyStore.getState().isAuthenticated) return;

      refreshAccount();
    });

    return () => subscription.remove();
  }, []);
}
