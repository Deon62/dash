import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import GoogleMark from "@/components/GoogleMark";
import Button from "@/components/Button";
import CountryPicker from "@/components/CountryPicker";
import {
  DEFAULT_COUNTRY,
  getCountry,
  isPhoneComplete,
  normalisePhone,
  phoneHint,
} from "@/theme/countries";
import { COLORS } from "@/theme/colors";
import { detectCountry } from "@/lib/geo";
import { sendPhoneOtp } from "@/lib/auth";
import {
  pendingReferralCode,
  setPendingReferralCode,
  tidyCode,
} from "@/lib/referrals";
import { useGoogleSignIn } from "@/lib/useGoogleSignIn";
import { useKeyboard } from "@/lib/useKeyboardVisible";
import { impact } from "@/lib/haptics";
/**
 * The published pages, not screens in the app.
 *
 * One copy of each, on the web, so a change to either reaches every installed
 * build without a release — and so the version a student agreed to is the
 * version a court could be shown. They live in `lib/legal` because the privacy
 * screen links to the same page from inside the app.
 */
import { PRIVACY_URL, TERMS_URL, openLegal } from "@/lib/legal";
import OfflineGate from "@/components/OfflineGate";

/**
 * Soft colour wash behind the top of the screen.
 *
 * The only colour on the page that is not doing a job, and it earns the
 * exception: this is the first screen anyone sees, and a sign-in page in pure
 * greyscale reads as unfinished. It stays behind the type, well under the
 * threshold where it would compete with the one blue button below it.
 */
function Aurora() {
  return (
    <View className="absolute inset-x-0 top-0 h-80" pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="a" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#007FFA" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#007FFA" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="b" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#00C2A8" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#00C2A8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="c" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
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
  const keyboard = useKeyboard();

  // Google is only offered where the build has OAuth client ids. A consent
  // screen that cannot complete is worse than an option that was never shown.
  const google = useGoogleSignIn();

  const scrollRef = useRef(null);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  /**
   * A friend's code, optional in every sense.
   *
   * Behind a disclosure rather than on the page, because this screen is also
   * where a returning student signs back in — the server only reads the code
   * on the request that *creates* an account, and a field offered to somebody
   * who already has one produces a support ticket that begins "I typed my
   * friend's code and nothing happened".
   *
   * Arriving by link opens it, already filled, as a line rather than a field:
   * there is nothing left to type and an input pre-populated with something a
   * student did not write invites them to change it.
   */
  const [referral, setReferral] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [fromLink, setFromLink] = useState(false);

  useEffect(() => {
    let cancelled = false;

    pendingReferralCode().then((code) => {
      if (cancelled || !code) return;
      setReferral(code);
      setFromLink(true);
      setShowReferral(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Written through as it is typed, not on Continue.
   *
   * `src/lib/auth.js` reads it out of there when it exchanges the code, and
   * Google sign-in leaves this screen entirely — so a value living in this
   * component's state would be attached to one of the two ways in and not the
   * other.
   */
  const writeReferral = (next) => {
    const code = tidyCode(next);
    setReferral(code);
    setPendingReferralCode(code);
  };

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

  // No navigation on success — the session guard reacts to the new session and
  // sends a new student to onboarding, a returning one to the tabs.
  const continueWithGoogle = async () => {
    if (busy || google.busy) return;
    impact("medium");
    setError("");
    await google.start();
  };

  // Scroll the number into view once the keyboard is up. The padding below
  // makes the room; this is what moves into it.
  useEffect(() => {
    if (!keyboard.visible) return undefined;
    const id = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      60
    );
    return () => clearTimeout(id);
  }, [keyboard.visible, keyboard.height]);

  return (
    /* Signing in is one of the few things in this app that genuinely cannot
       happen offline — the code comes by SMS and the token comes from the
       server — so the gate here states a fact rather than withholding
       anything. Not `bare`: there is nowhere to go back to. */
    <OfflineGate name="login">
      {/* No KeyboardAvoidingView. With edge-to-edge enabled the Android window
          is never resized for the keyboard, so it has nothing to react to and
          left the number sitting underneath — the measured height below is
          what actually works, on both platforms. */}
      <View className="flex-1 bg-canvas">
      <Aurora />

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Well clear of the notch: the heading is the first thing read and
          // it should not start against the top of the glass.
          paddingTop: insets.top + 96,
          paddingBottom: insets.bottom + 28 + keyboard.height,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        {/* The old hero said "your whole course, in one place", which is every
            folder app ever made. The thing worth saying is that the tutor
            studies *your* material — that is the product, and it belongs on the
            first screen rather than being discovered three tabs in. */}
        <Text className="font-jk-bold text-ink text-[30px] leading-[38px] text-center">
          The AI that actually{"\n"}did your readings.
        </Text>
        <Text className="font-jk text-muted text-[14.5px] leading-[22px] text-center mt-3.5">
          Feed it your notes, slides and past papers. It learns your units and
          revises with you, quoting the exact source it got the answer from.
        </Text>

        {/* The sign-in controls sit in the vertical middle rather than packed
            under the heading — the page reads as a heading at the top, the
            thing you came to do in the middle, and small print at the foot. */}
        <View className="flex-1 justify-center py-10">
          {google.available ? (
            <>
              <Pressable
                onPress={continueWithGoogle}
                disabled={Boolean(busy) || google.busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                accessibilityState={{
                  disabled: Boolean(busy) || google.busy,
                  busy: google.busy,
                }}
                className={`flex-row items-center justify-center gap-x-3 rounded-2xl border border-line py-4 ${
                  busy || google.busy ? "opacity-50" : "active:bg-surface"
                }`}
              >
                <GoogleMark size={18} />
                <Text className="font-jk-med text-ink text-[15px]">
                  {google.busy ? "Signing in…" : "Continue with Google"}
                </Text>
              </Pressable>

              <View className="flex-row items-center gap-x-3 my-7">
                <View className="flex-1 h-px bg-line" />
                <Text className="font-jk text-muted text-[11px]">or</Text>
                <View className="flex-1 h-px bg-line" />
              </View>
            </>
          ) : null}

          {/* A rule, like every other input in the app. The Google control
              above keeps its outline because it is a button, not a field. */}
          <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
            MOBILE NUMBER
          </Text>
          <View
            style={{ borderBottomWidth: 1, borderBottomColor: COLORS.line }}
            className="flex-row items-center"
          >
            <CountryPicker value={country} onChange={setCountry} />
            <TextInput
              value={digits}
              onChangeText={(next) => setPhone(normalisePhone(next, selected))}
              placeholder={selected.iso === "KE" ? "712 345 678" : "Mobile number"}
              placeholderTextColor="#A1A1AA"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              className="flex-1 py-3 font-jk text-ink text-[15.5px]"
            />
          </View>

          <Text
            style={{ marginTop: 12 }}
            className="font-jk text-muted text-[11.5px] leading-[17px]"
          >
            {digits.length > 0 && !canContinue
              ? phoneHint(selected)
              : `We'll text a code to ${selected.dial} ${digits || "…"}`}
          </Text>

          {/* Never blocks Continue, never validates, never shows an error. An
              unknown code is ignored by the server and the account is created
              normally — a student mistyping their friend's code must still
              end up with an account. */}
          {fromLink ? (
            <Text className="font-jk text-muted text-[12px] mt-4">
              Joining with{" "}
              <Text className="font-jk-med text-ink tracking-[1px]">
                {referral}
              </Text>
            </Text>
          ) : showReferral ? (
            <View style={{ marginTop: 20 }}>
              <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
                REFERRAL CODE (OPTIONAL)
              </Text>
              <View
                style={{ borderBottomWidth: 1, borderBottomColor: COLORS.line }}
              >
                <TextInput
                  value={referral}
                  onChangeText={writeReferral}
                  placeholder="K7M2QX"
                  placeholderTextColor="#A1A1AA"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  autoFocus
                  className="py-3 font-jk text-ink text-[15.5px] tracking-[2px]"
                />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                impact("light");
                setShowReferral(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="I have a referral code"
              hitSlop={8}
              className="self-start py-2 mt-2 active:opacity-60"
            >
              {/* Underlined, because it is the only thing on this screen that
                  opens something rather than submitting it, and a bare grey
                  sentence among two fields reads as a caption nobody can
                  press. */}
              <Text className="font-jk-med text-muted text-[12px] underline">
                I have a referral code
              </Text>
            </Pressable>
          )}

          {error || google.error ? (
            <Text className="font-jk text-danger text-[12px] leading-[17px] mt-2">
              {error || google.error}
            </Text>
          ) : null}

          {/* Inline, because a `mt-*` class next to an inline style is the
              combination NativeWind drops — which is what left this button
              pressed up against the line above it. */}
          <View style={{ marginTop: 32 }}>
            <Button
              label="Continue"
              busyLabel="Sending code…"
              busy={busy === "phone"}
              disabled={!canContinue || Boolean(busy)}
              onPress={continueWithPhone}
            />
          </View>
        </View>

        {/* Both underlined and pressable. "You agree to the Terms" with no way
            to read them is a sentence that asks for consent to something it
            will not show you. They open in the system browser rather than a
            screen in the app: the pages are published on the web, and a copy
            inlined here is a copy that goes stale the day either is edited. */}
        <Text className="font-jk text-muted text-[11px] leading-[16px] text-center">
          By continuing you agree to the{" "}
          <Text
            className="font-jk-med text-ink underline"
            accessibilityRole="link"
            onPress={() => openLegal(TERMS_URL)}
          >
            Terms
          </Text>{" "}
          and{" "}
          <Text
            className="font-jk-med text-ink underline"
            accessibilityRole="link"
            onPress={() => openLegal(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
      </View>
    </OfflineGate>
  );
}
