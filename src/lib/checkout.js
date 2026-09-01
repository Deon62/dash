import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";

import { billing } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { applySubscription, ensureGroup, loadSubscription } from "@/lib/billing";

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
 * mints the page with the payer's id against it, so the payment arrives already
 * tied to a student.
 *
 * Verifying is not a courtesy here, it is the settlement path. The card account
 * is shared with another product, so its webhook cannot be pointed at ALS and
 * nothing arrives on its own — `confirmCheckout` running when the browser
 * closes is what turns a charge into a plan. A server-side sweep catches what
 * the app misses, minutes later, which is a backstop and not a plan.
 *
 * Everything here resolves to `{ ..., error }` and never throws, matching the
 * rest of `src/api` — a rejection inside a button handler takes the screen
 * down with it.
 */

/**
 * Where the provider sends the browser once a payment page is finished with.
 *
 * The server puts this on each transaction as its `callback_url`, per payment
 * rather than in a dashboard — deliberately, because that dashboard is shared
 * with another product and changing a setting there would silently redirect
 * *its* payments here. So the two halves are kept in step by this constant
 * being the single written-down copy: whatever the server sends has to be this
 * exact string, or the browser lands somewhere that is not the app and the
 * student is left on a receipt with no way back.
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
 * The payment currently out at the provider.
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
 * Opens a hosted payment page and remembers what it is for.
 *
 * The system browser rather than a WebView: this is a real payment page and a
 * student should be able to see the address bar it is being entered on. A
 * WebView also hides whether the page is the provider's or ours, which is
 * exactly the thing not to teach people to ignore.
 *
 * `openAuthSessionAsync` rather than `openBrowserAsync`, for the return trip:
 * it watches for `PAYMENT_RETURN_URL` and closes the tab itself when the
 * provider redirects to it. `openBrowserAsync` has nothing to watch for, so the
 * tab sat on a receipt page until the student found their own way back — and
 * the app, having no idea they had returned, asked them whether they had paid.
 *
 * It takes a URL rather than fetching one, because two different endpoints mint
 * these now: `/billing/card`, and `/billing/mpesa` when it answers with a
 * fallback page. Both end the same way, and the ending is the part worth having
 * in one place.
 *
 * `returned` says the browser came back through that redirect. Every ending
 * sends it — paid, closed, abandoned — so it is not evidence of payment and is
 * never treated as any. It only decides whether to verify straight away or ask
 * first, and asking is worth it only when the tab was left some other way.
 */
export async function openCheckoutPage(url, { reference, tier }) {
  await rememberPayment({ reference, tier });

  const result = await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_URL);

  // The browser closing says nothing about whether money moved. Only the server
  // knows, which is what `confirmCheckout` is for.
  return { returned: result?.type === "success" };
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
 * `pending` is a real outcome and not a failure. A card can take a moment to
 * settle and the server's sweep credits anything that lands late — so a student
 * who checks a beat too early should be told to wait, never told it failed.
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

  // Through the shared mapper rather than a second copy of the same eight
  // fields. Three things hand over a subscription row now, and a row mapped in
  // three places is a field renamed in two of them.
  applySubscription(data);

  // A Friends payment buys five other seats and a code to hand them out with,
  // and neither exists until the group does. Doing it here is what puts that
  // code on the screen the student is about to land on.
  if (data.seats > 1) await ensureGroup();

  // Settled, so nothing should try to verify it again — not a cold start, and
  // not `app/paymentreturn.jsx` on some later stray navigation.
  await forgetPayment();

  return { pending: false, error: null };
}

/** Re-reads the plan. Used when a screen needs the truth rather than a cache. */
export async function refreshPlan() {
  return loadSubscription();
}
