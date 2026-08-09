import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, ChevronLeft, Lock, Mail, UserRound } from "lucide-react-native";

import TextField from "@/components/TextField";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useTransitStore((state) => state.signIn);
  const updateProfile = useTransitStore((state) => state.updateProfile);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit =
    name.trim().length > 1 && email.trim().length > 3 && password.length >= 6;

  const submit = () => {
    if (!canSubmit) return;
    impact("medium");
    // No auth backend yet — this seeds the local profile and routes on.
    updateProfile({ name: name.trim(), email: email.trim() });
    signIn(email.trim());
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-brand-canvas"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
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

        <Text className="font-jk-black text-brand-black text-[30px] leading-[36px] mt-8">
          Create account
        </Text>
        <Text className="font-jk text-brand-muted text-[14px] leading-[20px] mt-2">
          Start tracking every matatu, boda and train you take.
        </Text>

        <View className="gap-y-4 mt-8">
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
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            Icon={Lock}
            secure
            autoCapitalize="none"
            textContentType="newPassword"
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Create account"
          accessibilityState={{ disabled: !canSubmit }}
          className={`flex-row items-center justify-center gap-x-2 rounded-2xl py-4 mt-7 ${
            canSubmit ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
          }`}
        >
          <Text className="font-jk-bold text-brand-white text-[15px]">
            Create account
          </Text>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>

        <Text className="font-jk text-brand-muted text-[11px] leading-[16px] text-center mt-5">
          By continuing you agree to the Terms and Privacy Policy.
        </Text>

        <View className="flex-row items-center justify-center mt-auto pt-10">
          <Text className="font-jk text-brand-muted text-[13px]">
            Already have an account?
          </Text>
          <Pressable
            onPress={() => {
              impact("light");
              router.replace("/login");
            }}
            accessibilityRole="button"
            accessibilityLabel="Log in instead"
            hitSlop={8}
            className="ml-1.5 active:opacity-60"
          >
            <Text className="font-jk-bold text-brand-black text-[13px]">Log in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
