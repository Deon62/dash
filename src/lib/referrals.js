import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { account } from "@/api/endpoints";
import { authed } from "@/lib/session";

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
 * The student's code and totals, re-read on every visit.
 *
 * On focus rather than on mount: a reward vests after a hold, and the natural
 * gesture for "has it landed yet" is to open the screen again. Failures are
 * kept rather than shown — this is a card beside the rest of a profile, and a
 * red line across it because a background read timed out is noise about
 * something the student did not ask for.
 */
export function useReferral() {
  const [state, setState] = useState({ ...EMPTY, loading: true, error: null });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      loadReferrals().then(({ referral, error }) => {
        if (cancelled) return;
        setState({
          ...(referral ?? EMPTY),
          loading: false,
          error: referral ? null : error,
        });
      });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return state;
}

/** One read. Resolves to `{ referral, error }` and never throws. */
export async function loadReferrals() {
  const { data, error } = await authed((token) => account.referrals(token));
  if (error) return { referral: null, error };

  return { referral: fromServer(data), error: null };
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
