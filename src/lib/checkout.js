import * as WebBrowser from "expo-web-browser";

import { billing, isBackendConfigured } from "@/api/endpoints";

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
 * Everything here resolves to `{ ... , error }` and never throws, matching the
 * rest of `src/api` — a rejection inside a button handler takes the screen
 * down with it.
 */

/** Why a checkout could not be started, in words meant for a student. */
const NO_SERVER =
  "Paying needs a connection to our server, and this build has none configured.";
const NOT_SIGNED_IN =
  "Sign in first — a payment has to be attached to your account, or there is no way to give you the plan.";

/**
 * Opens a payment page for one plan and returns the reference to verify.
 *
 * The system browser rather than a WebView: this is a real payment page and a
 * student should be able to see the address bar it is being entered on. A
 * WebView also hides whether the page is the provider's or ours, which is
 * exactly the thing not to teach people to ignore.
 */
export async function startCheckout(tier, token) {
  if (!isBackendConfigured) return { reference: null, error: NO_SERVER };
  if (!token) return { reference: null, error: NOT_SIGNED_IN };

  const { data, error } = await billing.checkout(tier, token);
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
 * Asks the server what happened to a reference.
 *
 * Safe to call more than once: the reference is unique, so a second call
 * returns the same subscription rather than extending it again.
 *
 * `pending` is a real outcome and not a failure. Mobile money can take a
 * minute, and Kora's webhook will credit the plan when it lands — so a student
 * who checks a moment too early should be told to wait, not told it failed.
 */
export async function confirmCheckout(reference, token) {
  if (!reference || !token) return { subscription: null, error: NOT_SIGNED_IN };

  const { data, error, status } = await billing.verifyPayment(reference, token);

  if (error) {
    return {
      subscription: null,
      pending: status === 402,
      error,
    };
  }

  return { subscription: data, pending: false, error: null };
}
