import * as WebBrowser from "expo-web-browser";

import { billing } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { loadGroup, loadSubscription } from "@/lib/billing";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * Paying for a plan.
 *
 * One place, because two screens sell the same three plans and a second copy
 * of this flow is a second chance to open the wrong link or skip the
 * verification step.
 *
 * The link is asked for per payment rather than shipped in the app. That is
 * the whole design: a fixed, shareable payment page is the same page for
 * everybody, so the charge it produces names no account and the server is left
 * reconciling against an email that phone sign-in never collected. The server
 * mints a Kora checkout with the payer's id in the metadata, so the payment
 * arrives already tied to a student.
 *
 * Everything here resolves to `{ ..., error }` and never throws, matching the
 * rest of `src/api` — a rejection inside a button handler takes the screen
 * down with it.
 */

/**
 * Opens a payment page for one plan and returns the reference to verify.
 *
 * The system browser rather than a WebView: this is a real payment page and a
 * student should be able to see the address bar it is being entered on. A
 * WebView also hides whether the page is the provider's or ours, which is
 * exactly the thing not to teach people to ignore.
 */
export async function startCheckout(tier) {
  const { data, error } = await authed((token) => billing.checkout(tier, token));
  if (error) return { reference: null, error };

  // `checkout_url` is the field; `authorization_url` is the same value under
  // its old name, kept by the server for one release. Reading both means this
  // works against a server on either side of that change.
  const url = data?.checkout_url ?? data?.authorization_url;
  if (!url) {
    return { reference: null, error: "The payment page could not be opened." };
  }

  await WebBrowser.openBrowserAsync(url);

  // The browser closing says nothing about whether money moved — the student
  // may have paid, given up, or be waiting on an M-Pesa prompt. Only the
  // server knows, which is what `confirmCheckout` is for.
  return { reference: data.reference, error: null };
}

/**
 * Asks the server what happened to a reference, and takes its answer.
 *
 * Safe to call more than once: the reference is unique, so a second call
 * returns the same subscription rather than extending it again.
 *
 * `pending` is a real outcome and not a failure. Mobile money can take a
 * minute, and Kora's webhook will credit the plan when it lands — so a student
 * who checks a moment too early should be told to wait, not told it failed.
 */
export async function confirmCheckout(reference) {
  if (!reference) {
    return { pending: false, error: "There is no payment to check." };
  }

  const { data, error, status } = await authed((token) =>
    billing.verifyPayment(reference, token),
  );

  if (error) {
    return { pending: status === 402, error };
  }

  useStudyStore.getState().setSubscription({
    tier: data.tier,
    nominalTier: data.nominal_tier ?? data.tier,
    planName: data.name,
    expiresAt: data.expires_at,
    daysRemaining: data.days_remaining,
    verified: Boolean(data.verified),
    seats: data.seats ?? 1,
    isExpired: Boolean(data.is_expired),
  });

  // A Friends payment buys four other seats and a code to hand them out with.
  // Reading the group straight away is what puts that code on the screen the
  // student is about to land on.
  if (data.seats > 1) await loadGroup();

  return { pending: false, error: null };
}

/** Re-reads the plan. Used when a screen needs the truth rather than a cache. */
export async function refreshPlan() {
  return loadSubscription();
}
