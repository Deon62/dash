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
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";
import OfflineGate from "@/components/OfflineGate";

/** Fixed so no parent can stretch the circle into a lozenge. */
const DISC = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: COLORS.surface,
};

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // `phone` is E.164 and must match what the code was sent to; `display` is the
  // prettier version for the heading.
  const { phone, display } = useLocalSearchParams();

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
    // No navigation here, and nothing to record: `verifyPhoneOtp` has already
    // written the server's tokens into the store, and the session guard reacts
    // to that — a new student to onboarding, a returning one to the tabs.
  };

  /**
   * Submits itself on the sixth digit.
   *
   * There is nothing to decide at this point — the code is either right or it
   * is not — so a button asking the student to confirm what they just typed is
   * a step that only exists to be tapped. Autofill from the SMS lands all six
   * at once and this catches that too.
   */
  useEffect(() => {
    if (complete) verify();
    // `verify` is redefined every render; keying on the code is what makes
    // this fire once per completed attempt rather than on each keystroke.
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Puts the caret back in the hidden field.
   *
   * Closing the keyboard — the Android back gesture, the iOS accessory bar —
   * does not blur this input, it only hides the keyboard. The field therefore
   * still believes it is focused, and `focus()` on an already-focused input is
   * a no-op: the six boxes become dead pixels and there is no way back to the
   * keyboard short of leaving the screen. Blurring first is what makes the
   * next tap open it again.
   */
  const focusCode = () => {
    const input = inputRef.current;
    if (!input) return;
    input.blur();
    // A tick later. Focusing in the same frame as the blur is swallowed on
    // Android, which lands back exactly where this started.
    setTimeout(() => inputRef.current?.focus(), 50);
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
    /* Same reason as the sign-in screen: the code being typed here has to be
       checked against the server, so there is nothing this page can usefully
       do without a connection. */
    <OfflineGate name="verify">
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
          style={DISC}
          className="active:opacity-60"
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
          onPress={focusCode}
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

        {error ? (
          <Text className="font-jk text-danger text-[12px] leading-[17px] mt-4">
            {error}
          </Text>
        ) : null}

        {/* Where the Verify button was. Something has to acknowledge the
            sixth digit, or the screen looks like it swallowed it. */}
        {busy ? (
          <Text className="font-jk text-muted text-[13px] text-center mt-8">
            Checking…
          </Text>
        ) : null}

        <Pressable
          onPress={resend}
          disabled={secondsLeft > 0 || busy}
          accessibilityRole="button"
          accessibilityLabel="Resend code"
          accessibilityState={{ disabled: secondsLeft > 0 }}
          className="self-center mt-8 active:opacity-60"
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
    </OfflineGate>
  );
}
