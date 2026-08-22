import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { UserRound } from "lucide-react-native";

import Screen from "@/components/Screen";
import Button from "@/components/Button";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import { useStudyStore } from "@/store/useStudyStore";
import { activeTier, canAddUnit } from "@/lib/quota";
import { impact, notify } from "@/lib/haptics";

export default function NewUnitScreen() {
  const router = useRouter();
  const addUnit = useStudyStore((state) => state.addUnit);
  const units = useStudyStore((state) => state.units);
  const subscription = useStudyStore((state) => state.subscription);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [lecturer, setLecturer] = useState("");

  const trimmedCode = code.trim().toUpperCase();
  const duplicate = units.some((unit) => unit.code === trimmedCode);

  const allowance = canAddUnit(activeTier(subscription), units.length);

  const canSave =
    trimmedCode.length >= 2 && title.trim().length >= 2 && !duplicate && allowance.ok;

  const save = () => {
    if (!canSave) return;
    impact("medium");
    const unit = addUnit({ code, title, lecturer });
    notify("success");
    // Straight into the new unit: the next thing a student wants is to put
    // something in it, and that lives one screen deeper.
    router.replace(`/unit/${unit.id}`);
  };

  return (
    <Screen bare keyboardAware>
      <ScreenHeader title="Add a unit" />

      <View className="gap-y-4">
        <TextField
          label="UNIT CODE"
          value={code}
          onChangeText={setCode}
          placeholder="CS201"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          hint={duplicate ? `You already have a unit called ${trimmedCode}.` : undefined}
        />
        <TextField
          label="UNIT NAME"
          value={title}
          onChangeText={setTitle}
          placeholder="Data Structures and Algorithms"
          autoCapitalize="words"
        />
        <TextField
          label="LECTURER"
          value={lecturer}
          onChangeText={setLecturer}
          placeholder="Optional"
          Icon={UserRound}
          autoCapitalize="words"
        />
      </View>

      {allowance.ok ? null : (
        <Pressable
          onPress={() => {
            impact("light");
            router.push("/billing");
          }}
          accessibilityRole="button"
          accessibilityLabel="See plans"
          className="rounded-2xl bg-surface px-4 py-3.5 active:opacity-60"
        >
          <Text className="font-jk-med text-ink text-[13.5px]">
            {allowance.detail}
          </Text>
          <Text className="font-jk text-primary text-[13px] mt-1">
            See plans →
          </Text>
        </Pressable>
      )}

      <Button label="Add unit" onPress={save} disabled={!canSave} />
    </Screen>
  );
}
