import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { Building2 } from "lucide-react-native";

import Screen from "@/components/Screen";
import SettingsHeader from "@/components/SettingsHeader";
import TextField from "@/components/TextField";
import { useTransitStore } from "@/store/useTransitStore";
import { impact, notify } from "@/lib/haptics";

export default function HomeCitySettingsScreen() {
  const router = useRouter();
  const homeCity = useTransitStore((s) => s.profile.homeCity);
  const updateProfile = useTransitStore((s) => s.updateProfile);

  const [city, setCity] = useState(homeCity ?? "");
  const trimmed = city.trim();
  const dirty = trimmed.length > 1 && trimmed !== homeCity;

  const save = () => {
    if (!dirty) return;
    impact("medium");
    updateProfile({ homeCity: trimmed });
    notify("success");
    router.back();
  };

  return (
    <Screen keyboardAware>
      <SettingsHeader eyebrow="LOCATION" title="Home city" />

      <TextField
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="Type your city"
        Icon={Building2}
        autoCapitalize="words"
        autoFocus
      />

      <Pressable
        onPress={save}
        disabled={!dirty}
        accessibilityRole="button"
        accessibilityLabel="Save home city"
        accessibilityState={{ disabled: !dirty }}
        className={`items-center justify-center rounded-2xl py-4 ${
          dirty ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
        }`}
      >
        <Text className="font-jk-bold text-brand-white text-[15px]">Save</Text>
      </Pressable>
    </Screen>
  );
}
