import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { account } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * Referrals, from the device's side.
 *
 * One sentence, and every screen has to be truthful about it:
 *
 *   Anyone can share their code. Nothing is earned until the friend who used
 *   it pays.
 *
 * The server owns all of it. The code is minted by the first `GET
 * /me/referrals` and never changes; the counts, the days and the wording of
 * what a friend gets come down with it. Nothing here computes a reward or
 * remembers one — a device that has its own opinion about what somebody has
 * earned is a device that will eventually be wrong in the student's favour,
 * which is the worst way to be wrong.
 *
 * There is no list of who joined. The payload has counts, not people: a screen
 * naming which friends did and did not subscribe is a screen that makes
 * students chase them.
 */

/** What a friend gets, until the server has said. Never shown as money. */
const FRIEND_DAYS = 7;

/** Nothing earned, nothing counted. The shape every screen renders first. */
const EMPTY = {
  code: null,
  joined: 0,
  paid: 0,
  daysEarned: 0,
  daysBanked: 0,
  /** Banked days waiting on a subscription rather than on the seven-day hold. */
  bankedPendingSubscription: false,
  friendDays: FRIEND_DAYS,
};

function fromServer(data) {
  return {
    code: data?.code ?? null,
    joined: data?.joined ?? 0,
    paid: data?.paid ?? 0,
    daysEarned: data?.days_earned ?? 0,
    daysBanked: data?.days_banked ?? 0,
    bankedPendingSubscription: Boolean(data?.banked_pending_subscription),
    // The server's number, not ours: the share message quotes it, and a
    // constant in the app is how the message and the reward drift apart.
    friendDays: data?.friend_days ?? FRIEND_DAYS,
  };
}

/**
 * How long a cached snapshot is used without asking again.
 *
 * The code inside it never changes, so this is really a limit on how stale the
 * *counts* may be. Ten minutes is chosen against what actually happens: a
 * friend subscribes, the reward waits out a seven-day hold, and then a number
 * moves. Nobody is watching this screen for a change that takes a week.
 */
const MAX_AGE_MS = 10 * 60 * 1000;

/**
 * The student's code and totals, from the cache first.
 *
 * Renders whatever was last read — instantly, and offline — then revalidates
 * behind it if that snapshot is old. The code is minted once and never
 * changes, so re-reading it on every visit is a request that can only return
 * what is already on screen.
 *
 * Nothing here can go badly wrong: the cache decides only what is drawn a beat
 * before the server answers, and the server's answer replaces it whenever one
 * arrives. A stale count is a number that is briefly low, which is the safe
 * direction — this app never grants anything, it only reports what was
 * granted.
 *
 * Failures are kept rather than shown. A red line across a page because a
 * background revalidation timed out is noise about something nobody asked for,
 * and the cached snapshot underneath it is still true.
 */
export function useReferral() {
  const cached = useStudyStore((state) => state.referral);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      // Only when it is worth asking. `loadReferrals` decides that rather than
      // this hook, so the same rule applies to any other caller.
      loadReferrals().then((result) => {
        if (!cancelled) setError(result.error);
      });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return {
    ...EMPTY,
    ...(cached ?? {}),
    // Only the very first read has nothing to draw. After that there is always
    // a snapshot, and a spinner over one is a screen hiding what it knows.
    loading: !cached,
    error: cached ? null : error,
  };
}

/**
 * One read, cached. Resolves to `{ referral, error }` and never throws.
 *
 * `force` is for the places that have just changed something the counts depend
 * on. Nothing does yet — every reward is granted server-side, on a hold — but
 * the door is here rather than in a screen's own `if`.
 */
export async function loadReferrals({ force = false } = {}) {
  const store = useStudyStore.getState();
  const cached = store.referral;

  const fresh = cached?.readAt && Date.now() - cached.readAt < MAX_AGE_MS;
  if (fresh && !force) return { referral: cached, error: null };

  const { data, error } = await authed((token) => account.referrals(token));

  // The cached snapshot is returned on a failure rather than null: a request
  // that did not answer has not made what we already knew untrue, and a screen
  // that blanks itself on a dropped connection is worse than one showing a
  // number from ten minutes ago.
  if (error) return { referral: cached ?? null, error };

  const referral = fromServer(data);
  store.setReferral(referral);

  return { referral, error: null };
}

/**
 * The share message.
 *
 * Built from what the server said a friend gets, and deliberately silent about
 * what the sender gets. It is true, it is fine, and it is not what makes
 * anybody tap — the offer is the friend's week.
 */
export function shareMessage({ code, friendDays }) {
  return (
    "Ardena helps me revise from my own lecture notes and past papers. " +
    `Use my code ${code} when you sign up and you get ${friendDays} days free.`
  );
}

// --- A code arriving from outside the app -----------------------------------

/**
 * A code carried in by a link, held until the account it belongs to is made.
 *
 * On disk as well as in memory, because the journey from tapping a friend's
 * link to finishing sign-in crosses an SMS, the messages app and — on the
 * phones this is written for — Android killing the app while the student is
 * reading the code out of a text.
 *
 * `referral_code` is only read by the request that *creates* an account, so it
 * is cleared once a sign-in has actually opened a session — not when it is
 * read. A mistyped SMS code must not cost the referral, and a code left on
 * disk after a successful sign-in would attribute the next person to use this
 * handset to somebody they have never met.
 */
const PENDING_KEY = "als.referral.pending";

let pending = null;

/** Six characters, no I/O/0/1. Trimmed and upper-cased, never validated here. */
export function tidyCode(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

export async function setPendingReferralCode(value) {
  const code = tidyCode(value);
  pending = code || null;

  try {
    if (code) await AsyncStorage.setItem(PENDING_KEY, code);
    else await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // The in-memory copy still works for this session. A referral is worth
    // less than a sign-in, and nothing here may stop one.
  }
}

export async function pendingReferralCode() {
  if (pending) return pending;

  try {
    pending = (await AsyncStorage.getItem(PENDING_KEY)) || null;
  } catch {
    pending = null;
  }

  return pending;
}

/** Spent. Called once a sign-in has opened a session, never before. */
export function clearPendingReferralCode() {
  return setPendingReferralCode(null);
}
