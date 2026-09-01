import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Minus } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import Segmented from "@/components/Segmented";
import Sheet from "@/components/Sheet";
import Notice, { toneForError } from "@/components/Notice";
import { useStudyStore } from "@/store/useStudyStore";
import {
  BillingPeriod,
  PLAN_CARDS,
  SubscriptionTier,
  cardFor,
  isSeason,
  monthsFor,
  planFeatures,
  planFor,
  planName,
  pricePerMonth,
  pricePerSeat,
  savingPercent,
  seatsFor,
} from "@/theme/plans";
import { activeTier, daysRemaining, hasEverPaid, isExpired } from "@/lib/quota";
import { confirmCheckout, pendingCheckout } from "@/lib/checkout";
import { loadPlans, loadSubscription } from "@/lib/billing";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";
import { pullSync } from "@/lib/sync";

/**
 * Pricing.
 *
 * Three cards, because three things are for sale — each in two lengths, which
 * is a toggle above them rather than six cards. Free is not one of them, so it
 * is not a fourth column with a KES 0 button on it — it is the panel above,
 * stating what the student already has. A card you cannot buy sitting in a row
 * of cards you can is a thing people try to press.
 *
 * The toggle opens on **Monthly**. The lower number is the honest default; a
 * screen that opens on the bigger figure reads as a trick, however much better
 * value it is. Switching swaps the price on every card in place — both sets
 * arrive in the same `GET /billing/plans`, so there is nothing to fetch and
 * nowhere to navigate.
 *
 * Every line on a card is generated from `PLAN_CONFIGS`, so a limit cannot be
 * changed in the config and left advertised wrongly here. The *prices* come
 * from the server on open: the app ships a copy so a card can be drawn with no
 * connection, but a price change has to be able to reach a phone without an
 * app store release, and when the two disagree the server is right.
 */
export default function BillingScreen() {
  const router = useRouter();

  const subscription = useStudyStore((state) => state.subscription);
  const group = useStudyStore((state) => state.group);

  /** Which length is on show. Screen state — deliberately not persisted. */
  const [period, setPeriod] = useState(BillingPeriod.MONTHLY);

  /** The tier a payment is being confirmed for, or null. */
  const [confirming, setConfirming] = useState(null);
  /** The reference the server gave us, so the sheet can verify rather than ask. */
  const [reference, setReference] = useState(null);
  /**
   * `{ tone, title, message, retry }`, or null.
   *
   * A shape rather than a bare string because these are not all the same kind
   * of event: a payment still clearing is not a failure, and telling somebody
   * their money has vanished when it is thirty seconds from landing is the
   * worst thing this screen can do.
   */
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  /** Prices as the server has them, keyed by tier. Empty until they land. */
  const [prices, setPrices] = useState({});

  const tier = activeTier(subscription);
  const left = daysRemaining(subscription);
  const expired = isExpired(subscription);
  // "Your plan has ended" is wrong on an account that never had one, and there
  // are now a great many of those.
  const lapsed = expired && hasEverPaid(subscription);
  const onFree = tier === SubscriptionTier.FREE;

  /**
   * The badge on the Season side: the best saving of the three, floored.
   *
   * The best rather than a per-plan figure, because it is a reason to tap and
   * not a spec — the exact number for the plan they choose is on the card
   * itself. The server's `saving_percent` wins wherever the prices have
   * arrived, so the badge cannot drift from what is actually charged.
   */
  const bestSaving = useMemo(
    () =>
      PLAN_CARDS.reduce((best, card) => {
        const season = card.tiers[BillingPeriod.SEASON];
        const fromServer = prices[season]?.savingPercent;
        return Math.max(best, fromServer || savingPercent(card.family));
      }, 0),
    [prices],
  );

  // A payment that was still clearing usually lands while this screen is open,
  // through the webhook rather than through anything the student did. When it
  // does, the plan changes underneath — and the card explaining that we could
  // not confirm it yet is now describing something that already happened.
  useEffect(() => {
    setNotice(null);
  }, [subscription?.tier, subscription?.verified]);

  useEffect(() => {
    let cancelled = false;

    loadPlans().then(({ plans }) => {
      if (cancelled || !plans.length) return;
      setPrices(Object.fromEntries(plans.map((plan) => [plan.tier, plan])));
    });

    // The plan may have changed since the last sync — a friend's payment, or a
    // webhook that landed while the app was closed.
    loadSubscription();

    /**
     * Picks up a payment this screen never saw the end of.
     *
     * Android is free to kill a backgrounded app while the student is on a
     * card page, and it does, on the phones this is written for. The reference
     * outlives that — `src/lib/checkout.js` keeps it on disk — so the way back
     * is to offer the check rather than to pretend the payment never happened.
     *
     * Only card payments land here. An STK payment never leaves the app, so
     * there is no browser to be killed behind and `/pay` polls it to an end.
     */
    pendingCheckout().then((payment) => {
      if (cancelled || !payment) return;
      if (!cardFor(payment.tier)) return;

      setReference(payment.reference);
      setConfirming(payment.tier);
      // Opening on the length they were buying, so the card being confirmed is
      // the card on screen behind the sheet.
      if (isSeason(payment.tier)) setPeriod(BillingPeriod.SEASON);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Pull to refresh.
   *
   * The most likely reason anyone pulls this page down is a payment that has
   * not shown up yet — a card settles on the server's sweep seconds to minutes
   * after the charge, and until it does the plan on screen is the old one. So this asks
   * the server for the subscription rather than only syncing coursework, which
   * would refresh everything except the thing being waited for.
   */
  const refresh = () => Promise.all([pullSync(), loadSubscription()]);

  // Only the person who paid has a code to see. A friend they invited is on
  // the same tier and lands on the same screen, but there is nothing there for
  // them to hand out.
  const paysForGroup =
    (group?.members ?? []).find((member) => member.isMe)?.isOwner ?? true;

  /**
   * Into the payment screen, rather than straight out to a browser.
   *
   * This used to mint a link and open a tab, because the old processor was one
   * hosted page that took every method. It is not one page any more: M-Pesa is an STK
   * prompt this app requests with a number the student types and then polls,
   * and only a card leaves for a browser. Neither of those is a thing a plan
   * card can do on its own, so the card's job stops at naming the tier.
   *
   * `/pay` owns everything after this — the number, the prompt, the poll, the
   * card hand-off and the verification.
   */
  const checkout = (buying) => {
    impact("medium");
    setNotice(null);
    router.push(`/pay?tier=${buying}`);
  };

  /**
   * Asks the server what happened, and takes its answer.
   *
   * Nothing here grants the plan. The device cannot see a charge, so the only
   * honest thing it can do is check the reference — and `pending` is a real
   * outcome, not a failure: mobile money takes a minute and the webhook will
   * credit the plan when it lands.
   */
  const unlock = async (bought = confirming, ref = reference) => {
    setBusy(true);
    const { error, pending } = await confirmCheckout(ref);
    setBusy(false);

    if (error) {
      // The sheet closes either way. Leaving it open over the answer means the
      // student has to dismiss a question in order to read the reply to it.
      setConfirming(null);

      setNotice(
        pending
          ? {
              tone: "waiting",
              title: "Your payment is still clearing",
              message:
                "Mobile money can take a minute or two to confirm. Nothing has gone wrong. Check again shortly and your plan unlocks as soon as it lands.",
              retry: () => unlock(bought, ref),
            }
          : {
              tone: toneForError(error),
              title: "We couldn't confirm that payment",
              message: `${error} If you were charged, the payment is safe and your plan will unlock on its own once it reaches us.`,
              retry: () => unlock(bought, ref),
            }
      );
      return;
    }

    notify("success");
    setNotice(null);
    setConfirming(null);
    setReference(null);

    // Paying for Friends buys five other seats, and a code nobody has been
    // handed yet is the same as not having bought them — so the payer lands
    // straight on the screen that gives it out.
    if (cardFor(bought)?.family === "friends") router.push("/friends");
  };

  return (
    <>
      <Screen bare onRefresh={refresh}>
        <ScreenHeader title="Plans" />

        {/* Directly under the heading, not at the foot of three tall cards.
            This is the reply to a question the student just asked — "did my
            payment go through" — and an answer they have to scroll past the
            whole shop to find is one they will not find at all.

            It stays on this screen rather than moving to Notifications with
            the app's other status: those are conditions you may or may not
            look at, this is the response to a button pressed a second ago. */}
        {notice ? (
          <Notice
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            actionLabel={busy ? undefined : "Check again"}
            onAction={notice.retry}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {/* What they have right now, before what they could buy. On free this
            is the only plan on the screen that is actually in force, and a
            student who does not know what free includes cannot tell whether
            KES 150 is worth it. */}
        {onFree ? (
          <View
            style={{
              borderColor: COLORS.line,
              borderWidth: 1,
              borderRadius: 24,
              padding: 20,
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-jk-bold text-ink text-[20px]">Free</Text>
                <Text className="font-jk text-muted text-[12.5px] mt-0.5">
                  {lapsed
                    ? "Where your plan left you. No time limit."
                    : "Enough to try it properly. No time limit."}
                </Text>
              </View>
              <View className="items-end mt-1">
                <Text className="font-jk-med text-primary text-[11px] tracking-[0.8px]">
                  CURRENT
                </Text>
              </View>
            </View>

            <View className="gap-y-2.5 mt-5">
              {planFeatures(SubscriptionTier.FREE).map((feature) => (
                <View key={feature.text} className="flex-row items-start">
                  {feature.available ? (
                    <Check size={14} color={COLORS.primary} strokeWidth={2.4} />
                  ) : (
                    <Minus size={14} color={COLORS.line} strokeWidth={2.4} />
                  )}
                  <Text
                    className={`text-[13px] leading-[19px] flex-1 ml-2.5 ${
                      feature.available
                        ? "font-jk text-ink"
                        : "font-jk text-muted line-through"
                    }`}
                  >
                    {feature.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Above the cards, because it changes all three of them. One control
            for the whole screen rather than a length picker on each card:
            three separate choices to make is three chances to buy the wrong
            one, and nobody wants Focus monthly and Synapse by the season. */}
        <View className="gap-y-3">
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: BillingPeriod.MONTHLY, label: "Monthly" },
              {
                value: BillingPeriod.SEASON,
                label: "Season",
                badge: bestSaving ? `−${bestSaving}%` : undefined,
              },
            ]}
          />

          {/* Said once, above the cards, rather than repeated on each: a
              Season is the same allowance four times over, and a student
              expecting four times the questions in one lump will feel cheated
              at week three. */}
          <Text className="font-jk text-muted text-[11.5px] leading-[17px] text-center px-4">
            {period === BillingPeriod.SEASON
              ? "Four months, one payment. The same allowance each month — a Season buys time, not a bigger allowance."
              : "One month at a time. Everything refills on the 1st."}
          </Text>
        </View>

        {PLAN_CARDS.map((card) => {
          const cardTier = card.tiers[period];
          // The server's price where it has arrived, the shipped one until
          // then, so a card is never blank while a request is in flight.
          const plan = { ...planFor(cardTier), ...(prices[cardTier] ?? {}) };

          // The plan they hold, in the length they hold it. Focus monthly does
          // not make the Focus Season card unbuyable — it is the next thing
          // that student might sensibly do.
          const current = cardTier === tier && !expired;
          // Held in the other length: worth saying so, or the card looks like
          // one they have not bought when they nearly have.
          const heldOtherLength =
            !current && !expired && cardFor(tier)?.family === card.family;

          const season = period === BillingPeriod.SEASON;
          const perMonth = plan.pricePerMonthKsh ?? pricePerMonth(cardTier);
          const seats = plan.seats ?? seatsFor(cardTier);

          return (
            <View
              key={card.family}
              style={{
                borderColor: current ? COLORS.primary : COLORS.line,
                backgroundColor:
                  card.tone === "shaded" ? COLORS.surface : COLORS.canvas,
                borderWidth: 1,
                borderRadius: 24,
                padding: 20,
              }}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-jk-bold text-ink text-[20px]">
                    {card.name}
                  </Text>
                  <Text className="font-jk text-muted text-[12.5px] mt-0.5">
                    {card.tagline}
                  </Text>
                </View>

                {/* Status rides on the card it describes rather than in a
                    banner above all three — the badge already says which plan,
                    so the days belong beside it. */}
                {current ? (
                  <View className="items-end mt-1">
                    <Text className="font-jk-med text-primary text-[11px] tracking-[0.8px]">
                      CURRENT
                    </Text>
                    {left !== null ? (
                      <Text className="font-jk text-muted text-[11px] mt-0.5">
                        {left} {left === 1 ? "day" : "days"} left
                      </Text>
                    ) : null}
                  </View>
                ) : heldOtherLength ? (
                  <View className="items-end mt-1">
                    <Text className="font-jk text-muted text-[11px]">
                      On {planName(tier)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* The total, big, because the total is what M-Pesa will ask for
                  — and a surprise at the STK prompt is a failed payment. What
                  it works out at per month goes underneath, smaller, where it
                  can be checked rather than sold. */}
              <View className="flex-row items-baseline mt-4">
                <Text className="font-jk-bold text-ink text-[28px]">
                  KES {plan.priceKsh}
                </Text>
                <Text className="font-jk text-muted text-[13px] ml-1.5">
                  {season ? `/ ${monthsFor(cardTier)} months` : `/ ${plan.durationDays} days`}
                </Text>
              </View>

              {season ? (
                <Text className="font-jk text-muted text-[12.5px] mt-1">
                  KES {perMonth}/month · {monthsFor(cardTier)} months
                  {plan.savingPercent || savingPercent(card.family)
                    ? ` · save ${plan.savingPercent || savingPercent(card.family)}%`
                    : ""}
                </Text>
              ) : null}

              {/* What it costs each person is the whole point of the group
                  plan, and it is not something to make anyone divide. Per
                  month on a Season, so the two lengths can be compared at all
                  — KES 700 each against KES 208 each is not a comparison. */}
              {card.perSeatNote ? (
                <Text className="font-jk text-muted text-[12.5px] mt-1">
                  KES{" "}
                  {season
                    ? `${Math.round(perMonth / Math.max(1, seats))} each a month`
                    : `${plan.pricePerSeatKsh ?? pricePerSeat(cardTier)} each`}
                  , for {seats} of you
                </Text>
              ) : null}

              <View className="gap-y-2.5 mt-5">
                {planFeatures(cardTier).map((feature) => (
                  <View key={feature.text} className="flex-row items-start">
                    {/* A limit you do not get is listed and struck through
                        rather than hidden — the difference between the plans
                        is the thing being sold, so it has to be visible on
                        every card. */}
                    {feature.available ? (
                      <Check size={14} color={COLORS.primary} strokeWidth={2.4} />
                    ) : (
                      <Minus size={14} color={COLORS.line} strokeWidth={2.4} />
                    )}
                    <Text
                      className={`text-[13px] leading-[19px] flex-1 ml-2.5 ${
                        feature.available
                          ? "font-jk text-ink"
                          : "font-jk text-muted line-through"
                      }`}
                    >
                      {feature.text}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="gap-y-2.5 mt-6">
                {/* The payer has somewhere to go: the code is on the Friends
                    screen and this card is the only route to it. Every other
                    plan has nothing behind it, so its button just states the
                    fact and stops being pressable. */}
                {current && card.family === "friends" ? (
                  <Button
                    label={paysForGroup ? "See code" : "See the plan"}
                    onPress={() => {
                      impact("light");
                      router.push("/friends");
                    }}
                  />
                ) : (
                  <Button
                    label={
                      current
                        ? "Your current plan"
                        : season
                          ? `Get ${card.name} for 4 months`
                          : `Get ${card.name}`
                    }
                    disabled={current}
                    onPress={() => checkout(cardTier)}
                  />
                )}

                {/* Only Friends has a way in that is not a payment, and this
                    is where someone holding a code will look for it. Grey
                    rather than blue: it is a real choice, but not the one
                    being sold. */}
                {card.family === "friends" && !current ? (
                  <Button
                    label="Join with a code"
                    variant="soft"
                    onPress={() => {
                      impact("light");
                      router.push("/join");
                    }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}

        <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
          {lapsed
            ? "Your plan has ended. You are on the free plan until you renew. "
            + "Nothing you filed has gone anywhere. "
            : ""}
          Questions, quizzes and scans all refill on the 1st of the month.
          Pay with M-Pesa or a card. Your plan activates once the payment
          clears.
        </Text>
      </Screen>

      {/* The device cannot see a charge, so it asks the server, which is the
          only side that can check the reference with the processor. */}
      <Sheet
        visible={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Did the payment go through?"
        subtitle={
          confirming
            ? `If you were charged for ${planName(confirming)}, tap below and we will check it against our records.`
            : undefined
        }
      >
        <View className="gap-y-3">
          <Button
            label={confirming ? `Check my ${planName(confirming)} payment` : "Check"}
            busyLabel="Checking…"
            busy={busy}
            onPress={() => unlock()}
            disabled={busy}
          />
          <Pressable
            onPress={() => {
              impact("light");
              setConfirming(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Not yet"
            className="items-center py-3 active:opacity-60"
          >
            <Text className="font-jk-med text-muted text-[14px]">Not yet</Text>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
}
