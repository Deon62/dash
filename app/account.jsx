import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Mail, UserRound } from "lucide-react-native";

import Screen from "@/components/Screen";
import TextField from "@/components/TextField";
import AvatarPicker from "@/components/AvatarPicker";
import { useTransitStore } from "@/store/useTransitStore";
import { impact, notify } from "@/lib/haptics";

export default function AccountScreen() {
  const router = useRouter();
  const profile = useTransitStore((state) => state.profile);
  const updateProfile = useTransitStore((state) => state.updateProfile);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);

  // Home city lives on its own settings page, not here.
  const dirty = name !== profile.name || email !== profile.email;

  const save = () => {
    if (!dirty) return;
    impact("medium");
    updateProfile({ name: name.trim(), email: email.trim() });
    notify("success");
    router.back();
  };

  return (
    <Screen keyboardAware>
      <Pressable
        onPress={() => {
          impact("light");
          router.back();
        }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full border border-brand-hairline bg-white active:opacity-70"
      >
        <ChevronLeft size={19} color="#09090B" strokeWidth={2.2} />
      </Pressable>

      <View className="items-center mt-2">
        <AvatarPicker />
      </View>

      <View className="gap-y-4 mt-6">
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          Icon={UserRound}
          autoCapitalize="words"
          autoComplete="name"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          Icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      <Pressable
        onPress={save}
        disabled={!dirty}
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        accessibilityState={{ disabled: !dirty }}
        className={`h-13 items-center justify-center rounded-2xl py-4 mt-7 ${
          dirty ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
        }`}
      >
        <Text className="font-jk-bold text-brand-white text-[15px]">
          Save changes
        </Text>
      </Pressable>
    </Screen>
  );
}
