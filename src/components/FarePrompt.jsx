import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

/**
 * Asked once a trip ends: what did it cost?
 *
 * Skipping records the ride with a zero fare rather than dropping it — the trip
 * still happened, and a missing fare shouldn't lose the leg from the history.
 */
export default function FarePrompt({ visible, modeLabel, onSubmit, onSkip }) {
  const currency = useTransitStore((state) => state.settings.currency);
  const [amount, setAmount] = useState("");

  // Clear between trips so the last fare isn't pre-filled into the next one.
  useEffect(() => {
    if (visible) setAmount("");
  }, [visible]);

  const value = Number(amount.replace(/[^\d.]/g, ""));
  const valid = amount.length > 0 && !Number.isNaN(value) && value >= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View className="flex-1 items-center justify-center bg-brand-black/40 px-8">
        <Pressable
          className="absolute inset-0"
          onPress={onSkip}
          accessibilityLabel="Dismiss fare prompt"
        />

        <View
          style={{
            shadowColor: "#09090B",
            shadowOpacity: 0.2,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 12 },
            elevation: 24,
          }}
          className="w-full rounded-3xl bg-white p-6"
        >
          <Text className="font-jk-black text-brand-black text-[18px]">
            What did it cost?
          </Text>
          <Text className="font-jk text-brand-slate text-[13px] mt-1.5">
            {modeLabel ? `Your ${modeLabel} fare.` : "Your fare for this leg."}
          </Text>

          <View className="flex-row items-center rounded-2xl border border-brand-hairline bg-white px-4 mt-5">
            <Text className="font-jk-bold text-brand-muted text-[15px] mr-2">
              {currency}
            </Text>
            <TextInput
              value={amount}
              onChangeText={(next) => setAmount(next.replace(/[^\d.]/g, ""))}
              placeholder="0"
              placeholderTextColor="#A1A1AA"
              keyboardType="numeric"
              autoFocus
              className="flex-1 py-4 font-jk-black text-brand-black text-[20px]"
            />
          </View>

          <View className="flex-row gap-x-3 mt-6">
            <Pressable
              onPress={() => {
                impact("light");
                onSkip();
              }}
              accessibilityRole="button"
              accessibilityLabel="Skip fare"
              className="flex-1 items-center justify-center rounded-2xl border border-brand-hairline py-3.5 active:opacity-70"
            >
              <Text className="font-jk-bold text-brand-black text-[14px]">Skip</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (!valid) return;
                impact("medium");
                onSubmit(value);
              }}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityLabel="Save fare"
              accessibilityState={{ disabled: !valid }}
              className={`flex-1 items-center justify-center rounded-2xl py-3.5 ${
                valid ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
              }`}
            >
              <Text className="font-jk-bold text-brand-white text-[14px]">Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
