import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CreditCard, Smartphone } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import { useStudyStore } from "@/store/useStudyStore";
import { impact, notify } from "@/lib/haptics";

/** Local Safaricom format: 07XXXXXXXX or 01XXXXXXXX. */
function isMpesaNumber(value) {
  return /^0[17]\d{8}$/.test(value.replace(/\s/g, ""));
}

export default function PaymentMethodsScreen() {
  const billing = useStudyStore((state) => state.billing);
  const updateBilling = useStudyStore((state) => state.updateBilling);

  const [number, setNumber] = useState(billing.mpesaNumber);

  const cleaned = number.replace(/\s/g, "");
  const valid = isMpesaNumber(cleaned);
  const dirty = cleaned !== billing.mpesaNumber;

  return (
    <Screen bare keyboardAware>
      <ScreenHeader
        title="Payment methods"
        description="How you'd pay if you upgrade. Nothing is charged from this screen."
      />

      {/* M-Pesa first: it is how most students here actually pay, and burying
          it under a card form would be backwards. */}
      <View>
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <Smartphone size={17} color="#09090B" strokeWidth={1.8} />
          </View>
          <View className="flex-1 ml-3.5">
            <Text className="font-jk-med text-ink text-[15px]">M-Pesa</Text>
            <Text className="font-jk text-muted text-[12.5px] mt-0.5">
              An STK push to this number
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <TextField
            label="SAFARICOM NUMBER"
            value={number}
            onChangeText={setNumber}
            placeholder="0712 345 678"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={13}
            hint={
              cleaned.length > 0 && !valid
                ? "That doesn't look like a Kenyan mobile number."
                : undefined
            }
          />

          <Pressable
            onPress={() => {
              if (!valid || !dirty) return;
              impact("medium");
              notify("success");
              updateBilling({ mpesaNumber: cleaned });
            }}
            disabled={!valid || !dirty}
            accessibilityRole="button"
            accessibilityLabel="Save M-Pesa number"
            accessibilityState={{ disabled: !valid || !dirty }}
            className={`items-center justify-center rounded-2xl py-3.5 mt-4 ${
              valid && dirty ? "bg-obsidian active:opacity-85" : "bg-surface"
            }`}
          >
            <Text
              className={`font-jk-med text-[14.5px] ${
                valid && dirty ? "text-canvas" : "text-muted"
              }`}
            >
              {billing.mpesaNumber && !dirty ? "Saved" : "Save number"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="border-t border-line pt-6">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <CreditCard size={17} color="#09090B" strokeWidth={1.8} />
          </View>
          <View className="flex-1 ml-3.5">
            <Text className="font-jk-med text-ink text-[15px]">Card</Text>
            <Text className="font-jk text-muted text-[12.5px] mt-0.5">
              Visa or Mastercard, through Paystack
            </Text>
          </View>
        </View>

        {/* Card details are deliberately not collected in the app. Paystack's
            own sheet takes them, so the numbers never touch this codebase. */}
        <View className="rounded-2xl bg-surface p-4 mt-4">
          <Text className="font-jk text-muted text-[13px] leading-[19px]">
            {billing.cardLast4
              ? `${billing.cardBrand} ending ${billing.cardLast4}.`
              : "Adding a card opens Paystack's own checkout, which also accepts mobile money. Card details are entered there, never here."}
          </Text>
        </View>

        <Pressable
          onPress={() => impact("light")}
          accessibilityRole="button"
          accessibilityLabel="Add a card with Paystack"
          disabled
          className="items-center justify-center rounded-2xl border border-line py-3.5 mt-3 opacity-50"
        >
          <Text className="font-jk-med text-muted text-[14.5px]">
            Add a card — needs the backend
          </Text>
        </Pressable>
      </View>

      <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
        The number is saved on this device only. Charging it needs a Paystack
        account and a server to hold the secret key, which does not exist yet.
      </Text>
    </Screen>
  );
}
