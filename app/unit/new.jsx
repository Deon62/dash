import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { UserRound } from "lucide-react-native";

import Screen from "@/components/Screen";
import Button from "@/components/Button";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import { useStudyStore } from "@/store/useStudyStore";
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
  const canSave = trimmedCode.length >= 2 && title.trim().length >= 2 && !duplicate;

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

      <Button label="Add unit" onPress={save} disabled={!canSave} />
    </Screen>
  );
}
