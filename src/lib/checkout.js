import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
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
 * Where Kora sends the browser once a payment page is finished with.
 *
 * The server is what puts this on the charge — `redirect_url` on the Kora
 * checkout call behind `POST /billing/checkout`. It is not a dashboard
 * setting and not something this app can pass in, so the two halves are kept
 * in step by this constant being the single written-down copy: whatever the
 * server sends has to be this exact string, or the browser lands somewhere
 * that is not the app and the student is left on a receipt with no way back.
 *
 * `com.ardena.als` rather than `als` because the package scheme is the one
 * guaranteed unique to this app; both are declared in `scheme` in app.json.
 *
 * `paymentreturn` is its own route rather than `billing` because a Friends
 * plan is bought from `/friends`, and a redirect straight to `/billing` would
 * land that student on the wrong screen — the deep link is a navigation
 * whether or not anything wanted one. `app/paymentreturn.jsx` verifies and
 * then sends them where the plan they just bought says they belong.
 */
export const PAYMENT_RETURN_URL = `${Application.applicationId}://paymentreturn`;

/**
 * The payment currently out at Kora.
 *
 * Kept here rather than in the screen that started it for the same reason the
 * Google request is kept in `src/lib/googleAuth.js`: the redirect comes back
 * as a deep link, Expo Router treats that as a navigation, and the screen
 * holding the reference in `useState` is unmounted by it. Written to disk as
 * well, because Android will kill a backgrounded app mid-payment and a
 * reference nobody remembers is a charge nobody verifies.
 */
const PENDING_KEY = "als.payment.pending";

/** Long enough for an M-Pesa prompt and a retry; short enough to go stale. */
const PENDING_TTL_MS = 30 * 60 * 1000;

let pendingPayment = null;

async function rememberPayment(payment) {
  pendingPayment = payment;
  try {
    await AsyncStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ ...payment, at: Date.now() }),
    );
  } catch {
    // The in-memory copy still covers everything but a cold start, and the
    // student can always press "check again" — nothing is lost, only automatic.
  }
}

/** The payment awaiting verification, or null. Does not clear it. */
export async function pendingCheckout() {
  if (pendingPayment) return pendingPayment;

  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw);
    if (!stored?.reference) return null;
    if (Date.now() - (stored.at ?? 0) > PENDING_TTL_MS) return null;

    return { reference: stored.reference, tier: stored.tier };
  } catch {
    return null;
  }
}

async function forgetPayment() {
  pendingPayment = null;
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // The TTL above is the backstop.
  }
}

/**
 * Opens a payment page for one plan and returns the reference to verify.
 *
 * The system browser rather than a WebView: this is a real payment page and a
 * student should be able to see the address bar it is being entered on. A
 * WebView also hides whether the page is the provider's or ours, which is
 * exactly the thing not to teach people to ignore.
 *
 * `openAuthSessionAsync` rather than `openBrowserAsync`, for the return trip:
 * it watches for `PAYMENT_RETURN_URL` and closes the tab itself when Kora
 * redirects to it. `openBrowserAsync` has nothing to watch for, so the tab sat
 * on Kora's receipt page until the student found their own way back — and the
 * app, having no idea they had returned, asked them whether they had paid.
 *
 * `returned` says the browser came back through that redirect. Kora sends it
 * on every ending — paid, closed, abandoned — so it is not evidence of payment
 * and is never treated as any. All it decides is whether to verify straight
 * away or to ask the student first, and asking is only worth it when they left
 * the tab some other way and may never have reached Kora at all.
 */
export async function startCheckout(tier) {
  const { data, error } = await authed((token) => billing.checkout(tier, token));
  if (error) return { reference: null, returned: false, error };

  // `checkout_url` is the field; `authorization_url` is the same value under
  // its old name, kept by the server for one release. Reading both means this
  // works against a server on either side of that change.
  const url = data?.checkout_url ?? data?.authorization_url;
  if (!url) {
    return {
      reference: null,
      returned: false,
      error: "The payment page could not be opened.",
    };
  }

  await rememberPayment({ reference: data.reference, tier });

  const result = await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_URL);

  // The browser closing says nothing about whether money moved — the student
  // may have paid, given up, or be waiting on an M-Pesa prompt. Only the
  // server knows, which is what `confirmCheckout` is for.
  return {
    reference: data.reference,
    returned: result?.type === "success",
    error: null,
  };
}

/**
 * Verifications in flight, by reference.
 *
 * Two things can ask about the same payment at the same moment: the screen
 * that opened the browser, when `openAuthSessionAsync` resolves, and
 * `app/paymentreturn.jsx`, when the router follows the same redirect. Both are
 * correct and neither can know about the other, so they share one request
 * rather than sending two — which would otherwise show the student two answers
 * to one question, and burn a rate-limit slot proving they agree.
 */
const inFlight = new Map();

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

  const existing = inFlight.get(reference);
  if (existing) return existing;

  const request = verify(reference).finally(() => inFlight.delete(reference));
  inFlight.set(reference, request);
  return request;
}

async function verify(reference) {
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

  // Settled, so nothing should try to verify it again — not a cold start, and
  // not `app/paymentreturn.jsx` on some later stray navigation.
  await forgetPayment();

  return { pending: false, error: null };
}

/** Re-reads the plan. Used when a screen needs the truth rather than a cache. */
export async function refreshPlan() {
  return loadSubscription();
}
