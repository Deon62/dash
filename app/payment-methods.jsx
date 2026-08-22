import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Sheet from "@/components/Sheet";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import { useStudyStore } from "@/store/useStudyStore";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

/** Local Safaricom format: 07XXXXXXXX or 01XXXXXXXX. */
function isMpesaNumber(value) {
  return /^0[17]\d{8}$/.test(value.replace(/\s/g, ""));
}

/** 0712345678 -> 0712 345 678, which is how it is read aloud. */
function pretty(number) {
  const digits = number.replace(/\D/g, "");
  if (digits.length !== 10) return number;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

/**
 * How the student would pay.
 *
 * A list of what is on file, not a form. The number is entered once in a sheet
 * and then never shown as an editable field again — a page that greets you
 * with a text box every visit looks like it lost what you gave it.
 *
 * Only M-Pesa is set up here, because a phone number is the only thing the app
 * needs to hold. Airtel Money and cards live entirely inside Paystack's own
 * checkout, so collecting anything for them in advance would mean storing
 * details we have no business keeping.
 */
export default function PaymentMethodsScreen() {
  const billing = useStudyStore((state) => state.billing);
  const updateBilling = useStudyStore((state) => state.updateBilling);

  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState("");

  const cleaned = number.replace(/\s/g, "");
  const valid = isMpesaNumber(cleaned);
  const saved = billing.mpesaNumber;

  const open = () => {
    impact("light");
    setNumber(saved);
    setEditing(true);
  };

  return (
    <>
      <Screen bare>
        <ScreenHeader title="Payment methods" />

        <View>
          {/* Logo left, number right — the row reads as "this method, this
              account", the way a wallet lists a card. */}
          <View className="flex-row items-center py-4 border-b border-line">
            <Image
              source={require("../assets/mpesa.png")}
              style={{ width: 76, height: 26 }}
              resizeMode="contain"
              accessibilityLabel="M-Pesa"
            />

            <View className="flex-1" />

            {saved ? (
              <Pressable
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`Change M-Pesa number, currently ${pretty(saved)}`}
                className="active:opacity-60"
              >
                <Text className="font-jk-med text-ink text-[14.5px]">
                  {pretty(saved)}
                </Text>
              </Pressable>
            ) : (
              <Text className="font-jk text-muted text-[13.5px]">Not set</Text>
            )}
          </View>

          {/* Deliberately not a filled button. Adding a payment method is not
              the main thing anyone came here to do, and a blue block would
              claim it was. */}
          <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel={saved ? "Change M-Pesa number" : "Add M-Pesa number"}
            className="flex-row items-center gap-x-2 py-4 active:opacity-60"
          >
            <Plus size={15} color={COLORS.muted} strokeWidth={1.8} />
            <Text className="font-jk-med text-muted text-[13.5px]">
              {saved ? "Change M-Pesa number" : "Add M-Pesa number"}
            </Text>
          </Pressable>
        </View>

        <Text className="font-jk text-muted text-[12.5px] leading-[19px] border-t border-line pt-5">
          You can also pay with Airtel Money or a card — both go through
          Paystack at checkout, so there is nothing to set up here.
        </Text>

        <Text className="font-jk text-muted text-[11.5px] leading-[17px] -mt-4">
          The number is saved on this device only. Charging it needs a Paystack
          account and a server to hold the secret key, which does not exist yet.
        </Text>
      </Screen>

      <Sheet
        visible={editing}
        onClose={() => setEditing(false)}
        title={saved ? "Change M-Pesa number" : "Add M-Pesa number"}
      >
        <View className="gap-y-4">
          <TextField
            label="SAFARICOM NUMBER"
            value={number}
            onChangeText={setNumber}
            placeholder="0712 345 678"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={13}
            autoFocus
            hint={
              cleaned.length > 0 && !valid
                ? "That doesn't look like a Kenyan mobile number."
                : "You'll get an STK push to approve on this number."
            }
          />

          <Button
            label="Save number"
            disabled={!valid}
            onPress={() => {
              notify("success");
              updateBilling({ mpesaNumber: cleaned });
              setEditing(false);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}
