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
import { ArrowLeft } from "lucide-react-native";

import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/auth";
import Button from "@/components/Button";
import { useStudyStore } from "@/store/useStudyStore";
import { impact, notify } from "@/lib/haptics";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // `phone` is E.164 and must match what the code was sent to; `display` is the
  // prettier version for the heading.
  const { phone, display } = useLocalSearchParams();

  const signIn = useStudyStore((state) => state.signIn);

  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const complete = code.length === CODE_LENGTH;

  const verify = async () => {
    if (!complete || busy) return;
    impact("medium");
    setBusy(true);
    setError("");

    const result = await verifyPhoneOtp(String(phone ?? ""), code);
    setBusy(false);

    if (result.error) {
      // Clear the boxes so the next attempt starts from a clean field rather
      // than the user having to delete six digits first.
      setCode("");
      setError(result.error);
      notify("error");
      return;
    }

    notify("success");
    // No navigation here — the session guard sends a new student to onboarding
    // and a returning one straight to the tabs.
    signIn(String(phone ?? ""));
  };

  const resend = async () => {
    if (secondsLeft > 0 || busy) return;
    impact("light");
    setError("");

    const result = await sendPhoneOtp(String(phone ?? ""));
    if (result.error) setError(result.error);
    else setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-canvas"
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
          className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-60"
        >
          <ArrowLeft size={18} color="#09090B" strokeWidth={1.8} />
        </Pressable>

        <Text className="font-jk-bold text-ink text-[30px] leading-[37px] mt-8">
          Enter the code
        </Text>
        <Text className="font-jk text-muted text-[14px] leading-[20px] mt-2">
          We sent a {CODE_LENGTH}-digit code to{" "}
          <Text className="font-jk-med text-ink">{display ?? phone}</Text>.
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
                    ? "border-primary bg-canvas"
                    : "border-line bg-canvas"
                }`}
              >
                <Text className="font-jk-semi text-ink text-[22px]">
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

        {/* Auth is not connected to a provider yet. Saying so beats a student
            waiting on a text that is never going to arrive. */}
        <View className="rounded-2xl border border-line bg-surface px-4 py-3 mt-5">
          <Text className="font-jk text-muted text-[12px] leading-[17px]">
            Sign-in is running offline for now — any {CODE_LENGTH} digits will
            let you in.
          </Text>
        </View>

        {error ? (
          <Text className="font-jk text-danger text-[12px] leading-[17px] mt-4">
            {error}
          </Text>
        ) : null}

        <View className="mt-6">
          <Button
            label="Verify"
            busyLabel="Checking…"
            busy={busy}
            disabled={!complete || busy}
            onPress={verify}
          />
        </View>

        <Pressable
          onPress={resend}
          disabled={secondsLeft > 0 || busy}
          accessibilityRole="button"
          accessibilityLabel="Resend code"
          accessibilityState={{ disabled: secondsLeft > 0 }}
          className="self-center mt-6 active:opacity-60"
        >
          <Text
            className={`text-[13px] ${
              secondsLeft > 0
                ? "font-jk text-muted"
                : "font-jk-med text-ink"
            }`}
          >
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
