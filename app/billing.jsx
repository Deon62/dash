import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Check, Minus } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useStudyStore } from "@/store/useStudyStore";
import { PLAN_CARDS, planFeatures, planFor } from "@/theme/plans";
import { activeTier, daysRemaining, isExpired } from "@/lib/quota";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

/**
 * Pricing.
 *
 * Two cards, because two things are for sale. The trial is not a product — it
 * is the seven days every account already has, so it is stated once at the top
 * rather than given a column of its own that nobody can buy.
 *
 * Every line on a card is generated from `PLAN_CONFIGS`, so a limit cannot be
 * changed in the config and left advertised wrongly here.
 */
export default function BillingScreen() {
  const subscription = useStudyStore((state) => state.subscription);
  const activatePlan = useStudyStore((state) => state.activatePlan);

  const [confirming, setConfirming] = useState(null);

  const tier = activeTier(subscription);
  const left = daysRemaining(subscription);
  const expired = isExpired(subscription);

  const checkout = async (card) => {
    impact("medium");
    // Opened in the system browser rather than a WebView: this is a real
    // payment page and the student should be able to see the address bar it
    // is being entered on.
    await WebBrowser.openBrowserAsync(card.checkoutUrl);
    // Nothing here knows whether they paid, so we ask instead of assuming.
    setConfirming(card);
  };

  return (
    <>
      <Screen bare>
        <ScreenHeader title="Plans" />

        {PLAN_CARDS.map((card) => {
          const plan = planFor(card.tier);
          const current = card.tier === tier && !expired;

          return (
            <View
              key={card.tier}
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
                    banner above both — the badge already says which plan, so
                    the days belong beside it. */}
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
                ) : null}
              </View>

              <View className="flex-row items-baseline mt-4">
                <Text className="font-jk-bold text-ink text-[28px]">
                  KES {plan.priceKsh}
                </Text>
                <Text className="font-jk text-muted text-[13px] ml-1.5">
                  / {plan.durationDays} days
                </Text>
              </View>

              <View className="gap-y-2.5 mt-5">
                {planFeatures(card.tier).map((feature) => (
                  <View key={feature.text} className="flex-row items-start">
                    {/* A limit you do not get is listed and struck through
                        rather than hidden — the difference between the plans
                        is the thing being sold, so it has to be visible on
                        both cards. */}
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

              <View className="mt-6">
                <Button
                  label={current ? "Your current plan" : `Get ${card.name}`}
                  disabled={current}
                  onPress={() => checkout(card)}
                />
              </View>
            </View>
          );
        })}

        <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
          {expired
            ? "Your plan has ended — you are back on trial limits until you renew. "
            : ""}
          Payment is handled by Paystack, which accepts M-Pesa, Airtel Money and
          cards. Your plan activates once the payment clears.
        </Text>
      </Screen>

      {/* The device cannot see a Paystack charge. Until a server receives the
          webhook, activation is the student's word — recorded as unverified so
          it can be reconciled rather than silently trusted. */}
      <Sheet
        visible={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Did the payment go through?"
        subtitle={
          confirming
            ? `We can't confirm it from here yet. If Paystack charged you for ${confirming.name}, unlock it now and it will be reconciled once accounts are connected.`
            : undefined
        }
      >
        <View className="gap-y-3">
          <Button
            label={confirming ? `Yes, unlock ${confirming.name}` : "Yes"}
            onPress={() => {
              notify("success");
              activatePlan(confirming.tier);
              setConfirming(null);
            }}
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
