import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";

import Screen from "@/components/Screen";
import Button from "@/components/Button";
import ScreenHeader from "@/components/ScreenHeader";
import { useStudyStore } from "@/store/useStudyStore";
import { impact } from "@/lib/haptics";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "KES 0",
    period: "forever",
    lines: [
      "Every unit, note and deadline",
      "Revision from your own material",
      "Stored on this device",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "KES 450",
    period: "a month",
    lines: [
      "Everything in Free",
      "PDF and slide text extraction",
      "Backup and sync across devices",
      "Longer answers with wider context",
    ],
  },
];

export default function BillingScreen() {
  const router = useRouter();

  const billing = useStudyStore((state) => state.billing);
  const updateBilling = useStudyStore((state) => state.updateBilling);

  return (
    <Screen bare>
      <ScreenHeader title="Billing" />

      <View className="gap-y-3">
        {PLANS.map((plan) => {
          const current = plan.key === billing.plan;

          return (
            <View
              key={plan.key}
              className={`rounded-3xl border p-5 ${
                current ? "border-primary bg-canvas" : "border-line bg-surface"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-jk-semi text-ink text-[16px]">{plan.name}</Text>
                {current ? (
                  <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px]">
                    CURRENT
                  </Text>
                ) : null}
              </View>

              <View className="flex-row items-baseline mt-2">
                <Text className="font-jk-semi text-ink text-[26px]">{plan.price}</Text>
                <Text className="font-jk text-muted text-[13px] ml-1.5">
                  {plan.period}
                </Text>
              </View>

              <View className="gap-y-2 mt-4">
                {plan.lines.map((line) => (
                  <View key={line} className="flex-row items-start">
                    <Check size={14} color="#71717A" strokeWidth={2} />
                    <Text className="font-jk text-muted text-[13px] leading-[19px] flex-1 ml-2.5">
                      {line}
                    </Text>
                  </View>
                ))}
              </View>

              {current ? null : (
                <View className="mt-5">
                  <Button
                    label={`Upgrade to ${plan.name}`}
                    // Nothing is charged here. Upgrading needs a payment
                    // method on file, so this sends them there rather than
                    // pretending a plan changed.
                    onPress={() => router.push("/payment-methods")}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
        Prices are placeholders and no payment is processed yet. Upgrading will
        run through Paystack once the account backend exists.
      </Text>

      {billing.plan === "free" ? null : (
        <Pressable
          onPress={() => {
            impact("light");
            updateBilling({ plan: "free" });
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel subscription"
          className="self-start active:opacity-60"
        >
          <Text className="font-jk-med text-danger text-[14px]">
            Cancel subscription
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}
