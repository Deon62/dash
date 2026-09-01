import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { billing } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { applySubscription, ensureGroup } from "@/lib/billing";
import { openCheckoutPage, confirmCheckout } from "@/lib/checkout";

/**
 * Taking a payment: a phone number, or a card.
 *
 * Two flows, and they are not two variants of one thing — which is why there is
 * no provider picker anywhere in the app and no provider name in any string a
 * student reads. M-Pesa is a request *this app* makes with a number they type,
 * after which the payment happens on the SIM toolkit with nothing to redirect
 * to and nothing to come back from; a card is a hosted page you leave for and
 * return from. Which processor handles either is the server's business and can
 * change without an app release.
 *
 * One rule governs the whole file, and it is the one that costs real money to
 * get wrong: **never tell a student a payment failed unless the server said so
 * in those words.** Not on a timeout, not on a closed browser, not on a
 * connection that dropped. There is no webhook on the card account, so a
 * server-side sweep settles anything the app did not see — and a student who
 * was debited being told it did not work is the worst thing this code can do.
 */

// --- M-Pesa -----------------------------------------------------------------

/**
 * Asks for an STK prompt. Resolves to `{ payment, error }`.
 *
 * `phone` goes up exactly as typed. Every shape people use — `0712…`,
 * `+254712…`, `254 712 345 678`, spaced, hyphenated — normalises server-side,
 * and the only refusal is a number that genuinely cannot receive a prompt, with
 * a sentence to show. Validating the format here instead is how an app ends up
 * refusing numbers that would have worked perfectly well.
 *
 * No amount is sent. The price comes from the server's plan table, because a
 * price the client can influence is a price the client can choose.
 */
export async function startMpesa(tier, phone) {
  const { data, error } = await authed((token) =>
    billing.mpesa(tier, phone, token),
  );

  if (error) return { payment: null, error };

  return {
    payment: {
      /**
       * `stk` — a prompt is ringing; poll.
       * `redirect` — M-Pesa was unreachable and the server opened a fallback
       * page. It is the same M-Pesa payment with a processor's fee on top, and
       * from here it is handled exactly like a card. The student is never told
       * which one they got; both are "paying with M-Pesa".
       */
      mode: data.mode,
      reference: data.reference,
      /** Safaricom's own wording of what the handset is about to say. */
      message: data.message ?? "",
      /** Normalised, and worth showing back: a typo caught here saves a wait. */
      phone: data.phone ?? "",
      amountKsh: data.amount_ksh ?? null,
      checkoutUrl: data.checkout_url ?? null,
    },
    error: null,
  };
}

/** One status read. `pending` is the field that decides, never `status`. */
async function readMpesaStatus(reference) {
  const { data, error } = await authed((token) =>
    billing.mpesaStatus(reference, token),
  );

  if (error) return { result: null, error };

  return {
    result: {
      status: data.status,
      message: data.message ?? "",
      pending: Boolean(data.pending),
      subscription: data.subscription ?? null,
    },
    error: null,
  };
}

/** How often to ask. Inside the documented 3–5s, and gentle on a connection. */
const POLL_MS = 4000;

/**
 * How long a `failed` answer is not believed.
 *
 * The bug this exists for: the app announced "that payment didn't go through"
 * several seconds *before* the STK prompt arrived on the handset. Asking the
 * instant the request returns catches a window where the record exists but
 * Safaricom has not answered for it yet, and whatever the status column happens
 * to say in that window is not a verdict — it is a race.
 *
 * So nothing is asked for the first few seconds, and a `failed` inside this
 * window is discarded and asked again rather than shown. A **success** is
 * always believed immediately: there is no story where the server says paid and
 * the money did not move, and making somebody wait to be told they have paid is
 * a different, sillier bug.
 *
 * This costs a real failure a few seconds of spinner. That is the right trade
 * by a distance — the cost of the other mistake is telling a student their
 * payment failed while their phone is still buzzing to ask for the PIN.
 */
const TRUST_FAILURE_AFTER_MS = 10000;

/**
 * How long before the app stops asking.
 *
 * An STK prompt expires on the handset at about sixty seconds, so two minutes
 * is comfortably past anything that is still going to happen. What follows is
 * *not* a failure — see `TIMED_OUT` below.
 */
const GIVE_UP_MS = 120000;

/**
 * What a student is told when the polling runs out.
 *
 * Never "it failed". The server's sweep settles a payment that arrives late,
 * and this branch is reached by a dropped connection as easily as by a real
 * problem. Telling somebody who has just been debited that their money did not
 * go through is the single worst sentence this flow could produce.
 */
export const TIMED_OUT =
  "We haven't heard back yet. If you were charged, your plan will turn on shortly.";

/**
 * Watches one STK payment until it settles, and stops asking when it should.
 *
 * A hook rather than a loop in the screen, because three things have to agree:
 * the interval, the deadline, and a re-poll whenever the app comes back to the
 * foreground — a student who switches to the SIM toolkit to type their PIN has
 * backgrounded the app, so that return is the single most likely moment for the
 * answer to have changed.
 *
 * Pass `null` to stop. Returns `{ settled, result, timedOut }`.
 */
export function useMpesaWatch(reference) {
  const [result, setResult] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  const startedAt = useRef(0);
  const done = useRef(false);

  const poll = useCallback(async () => {
    if (!reference || done.current) return;

    const { result: next, error } = await readMpesaStatus(reference);

    // A failed *request* is not a failed payment. The connection dropped, or
    // the server hiccuped; the next tick asks again, and the deadline is what
    // eventually stops it.
    if (error || !next) return;

    if (next.pending) return;

    // Too early to believe a failure. See `TRUST_FAILURE_AFTER_MS` — the app
    // must never reach a verdict before the handset has even rung.
    if (
      next.status !== "success" &&
      Date.now() - startedAt.current < TRUST_FAILURE_AFTER_MS
    ) {
      return;
    }

    done.current = true;
    setResult(next);

    // The success carries the subscription, so the plan is live on the device
    // without a second call at the exact moment the student is watching.
    if (next.status === "success" && next.subscription) {
      applySubscription(next.subscription);

      // A Friends payment buys five other seats and a code to hand them out
      // with, and neither exists until the group does. Unawaited: the screen
      // says "paid" now, and the code is read on the screen that shows it.
      if ((next.subscription.seats ?? 1) > 1) ensureGroup();
    }
  }, [reference]);

  useEffect(() => {
    // A new reference is a new attempt — each one gets its own, and none is
    // ever reused. Resetting here is what stops the previous attempt's verdict
    // being shown against it.
    done.current = false;
    startedAt.current = Date.now();
    setResult(null);
    setTimedOut(false);

    if (!reference) return undefined;

    // No poll at t=0. The request has only just returned; the prompt has not
    // reached the phone, and there is nothing to learn that is worth the risk
    // of reading a status that is still settling.
    const timer = setInterval(() => {
      if (done.current) return;

      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setTimedOut(true);
        done.current = true;
        return;
      }

      poll();
    }, POLL_MS);

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") poll();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [reference, poll]);

  return { settled: result, timedOut };
}

// --- Cards ------------------------------------------------------------------

/**
 * Opens the card page and settles whatever happened. `{ paid, pending, error }`.
 *
 * `confirmCheckout` runs **however the browser ended** — paid, cancelled, back
 * button, tab swiped away. That is not defensiveness, it is the design: there
 * is no webhook on this account, so this call is what settles the payment.
 * People also close the page after paying, so "they looked like they cancelled"
 * is not evidence of anything.
 */
export async function payByCard(tier) {
  const { data, error, status } = await authed((token) => billing.card(tier, token));

  if (error) {
    return {
      paid: false,
      pending: false,
      error:
        status === 503
          ? "Card payments aren't available right now. You can pay with M-Pesa instead."
          : error,
    };
  }

  if (!data?.checkout_url) {
    return { paid: false, pending: false, error: "The payment page could not be opened." };
  }

  await openCheckoutPage(data.checkout_url, { reference: data.reference, tier });

  const settled = await confirmCheckout(data.reference);

  return {
    paid: !settled.error && !settled.pending,
    pending: Boolean(settled.pending),
    error: settled.pending ? null : settled.error,
  };
}

/**
 * The M-Pesa fallback, which is a card payment wearing an M-Pesa coat.
 *
 * Reached when `startMpesa` answers `mode: "redirect"` because Safaricom was
 * down or refusing. Same hosted page, same verify on close — and deliberately
 * never named as anything different to the student, who asked to pay with
 * M-Pesa and is paying with M-Pesa.
 */
export async function finishRedirect(payment, tier) {
  await openCheckoutPage(payment.checkoutUrl, {
    reference: payment.reference,
    tier,
  });

  const settled = await confirmCheckout(payment.reference);

  return {
    paid: !settled.error && !settled.pending,
    pending: Boolean(settled.pending),
    error: settled.pending ? null : settled.error,
  };
}
