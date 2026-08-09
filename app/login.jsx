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
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
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
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

/** Soft colour wash behind the top of the screen — the page's only colour. */
function Aurora() {
  return (
    <View className="absolute inset-x-0 top-0 h-80" pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="a" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#2a78d6" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#2a78d6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="b" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#eb6834" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#eb6834" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="c" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#1baf7a" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#1baf7a" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="18%" cy="16%" r="150" fill="url(#a)" />
        <Circle cx="88%" cy="8%" r="140" fill="url(#b)" />
        <Circle cx="62%" cy="40%" r="130" fill="url(#c)" />
      </Svg>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useTransitStore((state) => state.signIn);

  const scrollRef = useRef(null);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");

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

  const continueWithPhone = () => {
    if (!canContinue) return;
    impact("medium");
    router.push({
      pathname: "/verify",
      params: { phone: `${selected.dial} ${digits}` },
    });
  };

  const continueWithGoogle = () => {
    impact("medium");
    // No provider wired yet — this stands in for the OAuth round trip.
    signIn({});
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-brand-canvas"
    >
      <Aurora />

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // The icon used to sit above the title; without it the heading needs
          // more room so it lands inside the colour wash rather than above it.
          paddingTop: insets.top + 96,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        <Text className="font-jk-black text-brand-black text-[32px] leading-[38px] text-center">
          Every trip,{"\n"}counted.
        </Text>
        <Text className="font-jk text-brand-slate text-[14px] leading-[20px] text-center mt-3">
          Sign in to pick up where your commute left off.
        </Text>

        {/* Google */}
        <Pressable
          onPress={continueWithGoogle}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          className="flex-row items-center justify-center gap-x-3 rounded-2xl border border-brand-border bg-white py-4 mt-9 active:opacity-70"
        >
          <GoogleMark size={19} />
          <Text className="font-jk-bold text-brand-black text-[15px]">
            Continue with Google
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-x-3 my-7">
          <View className="flex-1 h-px bg-brand-hairline" />
          <Text className="font-jk-semi text-brand-muted text-[11px]">or</Text>
          <View className="flex-1 h-px bg-brand-hairline" />
        </View>

        {/* Phone */}
        <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[1.5px] mb-2">
          MOBILE NUMBER
        </Text>
        <View className="flex-row items-center rounded-2xl border border-brand-hairline bg-white px-4">
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
            className="flex-1 py-4 font-jk-semi text-brand-black text-[15px]"
          />
        </View>

        <Text className="font-jk text-brand-muted text-[11px] mt-2 ml-1">
          {digits.length > 0 && !canContinue
            ? phoneHint(selected)
            : `We'll text a code to ${selected.dial} ${digits || "…"}`}
        </Text>

        <Pressable
          onPress={continueWithPhone}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue with phone number"
          accessibilityState={{ disabled: !canContinue }}
          className={`flex-row items-center justify-center gap-x-2 rounded-2xl py-4 mt-5 ${
            canContinue ? "bg-brand-black active:opacity-85" : "bg-brand-black/20"
          }`}
        >
          <Text className="font-jk-bold text-brand-white text-[15px]">
            Continue
          </Text>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>

        <Text className="font-jk text-brand-muted text-[11px] leading-[16px] text-center mt-auto pt-10">
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
