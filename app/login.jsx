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
import { ArrowRight, Lock, Mail } from "lucide-react-native";

import TextField from "@/components/TextField";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useTransitStore((state) => state.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  const submit = () => {
    if (!canSubmit) return;
    impact("medium");
    // No auth backend yet — this only flips the session flag and routes on.
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
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        <Text className="font-jk-black text-brand-black text-[17px] tracking-[4px]">
          TRANSIT
        </Text>

        <Text className="font-jk-black text-brand-black text-[30px] leading-[36px] mt-10">
          Welcome back
        </Text>
        <Text className="font-jk text-brand-muted text-[14px] leading-[20px] mt-2">
          Pick up where your commute left off.
        </Text>

        <View className="gap-y-4 mt-9">
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
            textContentType="password"
          />
        </View>

        <Pressable
          onPress={() => impact("light")}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          className="self-end mt-4 active:opacity-60"
        >
          <Text className="font-jk-semi text-brand-slate text-[12px]">
            Forgot password?
          </Text>
        </Pressable>

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Log in"
          accessibilityState={{ disabled: !canSubmit }}
          className={`flex-row items-center justify-center gap-x-2 rounded-2xl py-4 mt-7 ${
            canSubmit ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
          }`}
        >
          <Text className="font-jk-bold text-brand-white text-[15px]">Log in</Text>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>

        <View className="flex-row items-center justify-center mt-auto pt-10">
          <Text className="font-jk text-brand-muted text-[13px]">
            New to Transit?
          </Text>
          <Pressable
            onPress={() => {
              impact("light");
              router.push("/sign-up");
            }}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            hitSlop={8}
            className="ml-1.5 active:opacity-60"
          >
            <Text className="font-jk-bold text-brand-black text-[13px]">
              Create an account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
