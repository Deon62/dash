import { useState } from "react";
import { Image, Text, View } from "react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import { useStudyStore } from "@/store/useStudyStore";
import { notify } from "@/lib/haptics";

/** Local Safaricom format: 07XXXXXXXX or 01XXXXXXXX. */
function isMpesaNumber(value) {
  return /^0[17]\d{8}$/.test(value.replace(/\s/g, ""));
}

/**
 * How the student would pay.
 *
 * Only M-Pesa is set up here, because a phone number is the only thing the app
 * needs to hold. Airtel Money and cards are handled inside Paystack's own
 * checkout when the time comes, so collecting anything for them in advance
 * would mean storing details we have no business keeping.
 */
export default function PaymentMethodsScreen() {
  const billing = useStudyStore((state) => state.billing);
  const updateBilling = useStudyStore((state) => state.updateBilling);

  const [number, setNumber] = useState(billing.mpesaNumber);

  const cleaned = number.replace(/\s/g, "");
  const valid = isMpesaNumber(cleaned);
  const dirty = cleaned !== billing.mpesaNumber;

  return (
    <Screen bare keyboardAware>
      <ScreenHeader title="Payment methods" />

      <View>
        <Image
          source={require("../assets/mpesa.png")}
          style={{ width: 104, height: 34 }}
          resizeMode="contain"
          accessibilityLabel="M-Pesa"
        />

        <View className="mt-5">
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
                : "You'll get an STK push to approve on this number."
            }
          />

          <View className="mt-4">
            <Button
              label={billing.mpesaNumber && !dirty ? "Saved" : "Save number"}
              disabled={!valid || !dirty}
              onPress={() => {
                notify("success");
                updateBilling({ mpesaNumber: cleaned });
              }}
            />
          </View>
        </View>
      </View>

      <Text className="font-jk text-muted text-[12.5px] leading-[19px] border-t border-line pt-5">
        You can also pay with Airtel Money or a card — both go through Paystack
        at checkout, so there is nothing to set up here.
      </Text>

      <Text className="font-jk text-muted text-[11.5px] leading-[17px] -mt-4">
        The number is saved on this device only. Charging it needs a Paystack
        account and a server to hold the secret key, which does not exist yet.
      </Text>
    </Screen>
  );
}
