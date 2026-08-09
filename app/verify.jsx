import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import { useTransitStore } from "@/store/useTransitStore";
import { impact, notify } from "@/lib/haptics";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams();
  const signIn = useTransitStore((state) => state.signIn);

  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const complete = code.length === CODE_LENGTH;

  const verify = () => {
    if (!complete) return;
    impact("medium");
    // No SMS provider wired yet — any six digits are accepted.
    signIn({ phone: String(phone ?? "") });
    notify("success");
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

        <Text className="font-jk-black text-brand-black text-[28px] leading-[34px] mt-8">
          Enter the code
        </Text>
        <Text className="font-jk text-brand-slate text-[14px] leading-[20px] mt-2">
          We sent a {CODE_LENGTH}-digit code to{" "}
          <Text className="font-jk-bold text-brand-black">{phone}</Text>.
        </Text>

        {/* One input behind six boxes — simpler and more reliable than six
            separate fields chasing focus between them. */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel="Enter verification code"
          className="flex-row justify-between mt-9"
        >
          {Array.from({ length: CODE_LENGTH }).map((_, index) => {
            const char = code[index];
            const active = index === code.length;

            return (
              <View
                key={index}
                className={`h-14 w-[46px] items-center justify-center rounded-2xl border ${
                  char || active
                    ? "border-brand-black bg-white"
                    : "border-brand-hairline bg-white"
                }`}
              >
                <Text className="font-jk-black text-brand-black text-[22px]">
                  {char ?? ""}
                </Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(next) =>
            setCode(next.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={CODE_LENGTH}
          // Off-screen rather than display:none, which would stop it focusing.
          style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        />

        <Pressable
          onPress={verify}
          disabled={!complete}
          accessibilityRole="button"
          accessibilityLabel="Verify code"
          accessibilityState={{ disabled: !complete }}
          className={`items-center justify-center rounded-2xl py-4 mt-8 ${
            complete ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
          }`}
        >
          <Text className="font-jk-bold text-brand-white text-[15px]">Verify</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (secondsLeft > 0) return;
            impact("light");
            setSecondsLeft(RESEND_SECONDS);
          }}
          disabled={secondsLeft > 0}
          accessibilityRole="button"
          accessibilityLabel="Resend code"
          accessibilityState={{ disabled: secondsLeft > 0 }}
          className="self-center mt-6 active:opacity-60"
        >
          <Text
            className={`text-[13px] ${
              secondsLeft > 0
                ? "font-jk text-brand-muted"
                : "font-jk-bold text-brand-black"
            }`}
          >
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
