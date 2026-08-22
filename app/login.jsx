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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";

import GoogleMark from "@/components/GoogleMark";
import CountryPicker from "@/components/CountryPicker";
import {
  DEFAULT_COUNTRY,
  getCountry,
  isPhoneComplete,
  normalisePhone,
  phoneHint,
} from "@/theme/countries";
import { detectCountry } from "@/lib/geo";
import { sendPhoneOtp, signInWithGoogle } from "@/lib/auth";
import { useStudyStore } from "@/store/useStudyStore";
import { impact } from "@/lib/haptics";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const signInWithEmail = useStudyStore((state) => state.signInWithEmail);

  const scrollRef = useRef(null);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const selected = getCountry(country);

  // Preselect the dialling code from the caller's IP. Never blocks the screen:
  // the default is already usable and the user can change it either way.
  useEffect(() => {
    let cancelled = false;
    detectCountry().then((iso) => {
      if (!cancelled) setCountry(iso);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-normalise when the country changes: switching from a 9-digit country to
  // an 8-digit one must not leave an over-long number sitting in the field.
  const digits = normalisePhone(phone, selected);
  const canContinue = isPhoneComplete(digits, selected);

  const continueWithPhone = async () => {
    if (!canContinue || busy) return;
    impact("medium");
    setBusy("phone");
    setError("");

    // E.164 — no spaces, no leading zero. Kept in this shape so swapping the
    // local stub for a real provider needs no change here.
    const e164 = `${selected.dial}${digits}`.replace(/[^\d+]/g, "");
    const result = await sendPhoneOtp(e164);

    setBusy(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push({
      pathname: "/verify",
      // `display` is only for the heading; `phone` is what the verify step
      // needs, and it has to match the number the code was sent to exactly.
      params: { phone: e164, display: `${selected.dial} ${digits}` },
    });
  };

  const continueWithGoogle = async () => {
    if (busy) return;
    impact("medium");
    setBusy("google");
    setError("");

    const result = await signInWithGoogle();
    setBusy(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    // No navigation here — the session guard reacts to the new session and
    // sends a new student to onboarding, a returning one to the tabs.
    signInWithEmail(result.email);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-canvas"
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 88,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        <Text className="font-jk-bold text-ink text-[30px] leading-[38px] text-center">
          Your whole course,{"\n"}in one place.
        </Text>
        <Text className="font-jk text-muted text-[14px] leading-[20px] text-center mt-3">
          Sign in to pick up your notes, deadlines and revision where you left
          them.
        </Text>

        {/* Google */}
        <Pressable
          onPress={continueWithGoogle}
          disabled={Boolean(busy)}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ disabled: Boolean(busy), busy: busy === "google" }}
          className={`flex-row items-center justify-center gap-x-3 rounded-2xl border border-line py-4 mt-10 ${
            busy ? "opacity-50" : "active:bg-surface"
          }`}
        >
          <GoogleMark size={18} />
          <Text className="font-jk-med text-ink text-[15px]">
            {busy === "google" ? "Signing in…" : "Continue with Google"}
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-x-3 my-6">
          <View className="flex-1 h-px bg-line" />
          <Text className="font-jk text-muted text-[11px]">or</Text>
          <View className="flex-1 h-px bg-line" />
        </View>

        {/* Phone */}
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-2">
          MOBILE NUMBER
        </Text>
        <View className="flex-row items-center rounded-2xl border border-line px-4">
          <CountryPicker value={country} onChange={setCountry} />
          <TextInput
            value={digits}
            onChangeText={(next) => setPhone(normalisePhone(next, selected))}
            // Scroll the field clear of the keyboard. KeyboardAvoidingView
            // alone leaves it under the keyboard on Android.
            onFocus={() =>
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)
            }
            placeholder={selected.iso === "KE" ? "712 345 678" : "Mobile number"}
            placeholderTextColor="#A1A1AA"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            className="flex-1 py-4 font-jk text-ink text-[15px]"
          />
        </View>

        <Text className="font-jk text-muted text-[11.5px] mt-2 ml-1">
          {digits.length > 0 && !canContinue
            ? phoneHint(selected)
            : `We'll text a code to ${selected.dial} ${digits || "…"}`}
        </Text>

        {error ? (
          <Text className="font-jk text-danger text-[12px] leading-[17px] mt-3 ml-1">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={continueWithPhone}
          disabled={!canContinue || Boolean(busy)}
          accessibilityRole="button"
          accessibilityLabel="Continue with phone number"
          accessibilityState={{
            disabled: !canContinue || Boolean(busy),
            busy: busy === "phone",
          }}
          className={`flex-row items-center justify-center gap-x-2 rounded-2xl py-4 mt-5 ${
            canContinue && !busy ? "bg-primary active:opacity-85" : "bg-surface"
          }`}
        >
          <Text
            className={`font-jk-med text-[15px] ${
              canContinue && !busy ? "text-canvas" : "text-muted"
            }`}
          >
            {busy === "phone" ? "Sending code…" : "Continue"}
          </Text>
          {canContinue && !busy ? (
            <ArrowRight size={16} color="#FFFFFF" strokeWidth={1.8} />
          ) : null}
        </Pressable>

        <Text className="font-jk text-muted text-[11px] leading-[16px] text-center mt-auto pt-10">
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
