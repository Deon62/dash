import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Building2, ChevronLeft, Mail, UserRound } from "lucide-react-native";

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
  const [homeCity, setHomeCity] = useState(profile.homeCity);

  const dirty =
    name !== profile.name ||
    email !== profile.email ||
    homeCity !== profile.homeCity;

  const save = () => {
    impact("medium");
    updateProfile({ name: name.trim(), email: email.trim(), homeCity: homeCity.trim() });
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

      <View className="mt-1">
        <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
          YOUR ACCOUNT
        </Text>
        <Text className="font-jk-black text-brand-black text-[23px] leading-[29px] mt-1.5">
          Personal details
        </Text>
      </View>

      <View className="items-center mt-4">
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
        <TextField
          label="Home city"
          value={homeCity}
          onChangeText={setHomeCity}
          placeholder="Where you commute"
          Icon={Building2}
          autoCapitalize="words"
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
