import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { PageLoader } from "@/components/Loader";
import { confirmCheckout, pendingCheckout } from "@/lib/checkout";
import { SubscriptionTier } from "@/theme/plans";

/**
 * Where Kora's redirect lands.
 *
 * The payment page ends by sending the browser to `PAYMENT_RETURN_URL` — see
 * `src/lib/checkout.js` — and the OS hands that URL to the app. Two things
 * react to it: `expo-web-browser`, which opened the tab and closes it, and
 * Expo Router, for which an incoming link is a navigation. This route is what
 * that navigation lands on, and it exists for the same reason
 * `app/oauthredirect.jsx` does: a path with no route behind it renders
 * "Unmatched Route" over a payment that went through perfectly well.
 *
 * It does the verification itself rather than leaving it to whichever screen
 * opened the browser, because that screen has just been unmounted by this
 * navigation — and on a phone that killed the app mid-payment it was never
 * coming back at all.
 *
 * The reference is preferred from `pendingCheckout` — held outside the tree
 * and on disk for exactly that case — because it also carries the tier, which
 * decides where the student goes next. Kora appends `?reference=` of its own,
 * which is the fallback: it is the same value, but on its own it says nothing
 * about what was being bought.
 *
 * Kora redirects here on *any* ending — paid, closed, abandoned — so arriving
 * proves nothing and the answer always comes from the server.
 * `confirmCheckout` is single-flight per reference, so the screen asking at
 * the same moment costs nothing and cannot produce a second, contradictory
 * answer.
 */
export default function PaymentReturn() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const payment = await pendingCheckout();
      if (cancelled) return;

      const reference = payment?.reference ?? params.reference ?? null;

      // Nothing outstanding: a stale link, or a payment already settled by the
      // screen that started it. Either way there is nothing to do but leave.
      if (!reference) {
        router.replace("/billing");
        return;
      }

      await confirmCheckout(reference);
      if (cancelled) return;

      /**
       * Neither outcome is handled here, on purpose.
       *
       * Success writes the plan into the store, and the screen below reads it.
       * A failure — or a payment still clearing, which is not a failure —
       * belongs on that screen too, phrased in its own words and with its own
       * "check again", rather than as a verdict delivered on a page with
       * nothing else on it. `confirmCheckout` leaves the reference in place
       * when it cannot settle, so the button there still has something to
       * check.
       *
       * Friends is the exception worth routing for: it buys four other seats,
       * and a code nobody has been handed is the same as not having bought
       * them.
       */
      router.replace(
        payment?.tier === SubscriptionTier.FRIENDS ? "/friends" : "/billing",
      );
    })();

    return () => {
      cancelled = true;
    };
    // Runs once: this screen is a redirect landing, not a view of anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <PageLoader label="Checking your payment…" />;
}
