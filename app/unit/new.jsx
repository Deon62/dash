import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { UserRound } from "lucide-react-native";

import Screen from "@/components/Screen";
import Button from "@/components/Button";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import { useStudyStore } from "@/store/useStudyStore";
import { canAddUnit } from "@/lib/quota";
import { impact, notify } from "@/lib/haptics";

export default function NewUnitScreen() {
  const router = useRouter();
  const addUnit = useStudyStore((state) => state.addUnit);
  const units = useStudyStore((state) => state.units);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [lecturer, setLecturer] = useState("");

  const trimmedCode = code.trim().toUpperCase();
  const duplicate = units.some((unit) => unit.code === trimmedCode);

  const allowance = canAddUnit(units.length);

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
          label="TAUGHT BY"
          value={lecturer}
          onChangeText={setLecturer}
          placeholder="Optional"
          Icon={UserRound}
          autoCapitalize="words"
        />
      </View>

      {/* Stated, not sold. This used to carry a "See plans →" line, which was
          right when the cap varied by tier and is a lie now that nothing lifts
          it: it walked a student to the paywall to buy a limit that is not for
          sale. A well with no affordance in it is the honest shape — the way
          out is on the unit they no longer need, not on this screen. */}
      {allowance.ok ? null : (
        <View className="rounded-2xl bg-surface px-4 py-3.5">
          <Text className="font-jk text-muted text-[13px] leading-[19px]">
            {allowance.detail}
          </Text>
        </View>
      )}

      <Button label="Add unit" onPress={save} disabled={!canSave} />
    </Screen>
  );
}
