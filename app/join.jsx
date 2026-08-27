import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import Notice, { toneForError } from "@/components/Notice";
import { joinGroup } from "@/lib/billing";
import { COLORS } from "@/theme/colors";
import { notify } from "@/lib/haptics";

const CODE_LENGTH = 8;

/**
 * Joining someone's Friends plan.
 *
 * One field and one button. Whoever lands here was sent a code by a friend and
 * has already decided — an explanation of what the plan is, what it costs, or
 * who pays would all be answering questions they are not asking. The page is
 * the code.
 *
 * The input is styled inline rather than with classes: this component passes a
 * style object, and in that combination the object wins outright.
 */
export default function JoinScreen() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = code.length === CODE_LENGTH && !busy;

  /**
   * The seat is the server's to give.
   *
   * Nothing is written here on the way in: whether the code is real, whether
   * the plan is still paid for, and whether there is a seat left are all
   * questions only the server can answer, and showing someone a plan they do
   * not have would be worse than the wait.
   */
  const join = async () => {
    if (!ready) return;

    setBusy(true);
    setError("");

    const result = await joinGroup(code);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    notify("success");
    // Replace, not push: going "back" to a join form you have already used is
    // a dead end.
    router.replace("/friends");
  };

  return (
    <Screen bare>
      <ScreenHeader />

      <View>
        <Text className="font-jk-bold text-ink text-[30px] leading-[37px] mt-6">
          Enter your code
        </Text>
        <Text className="font-jk text-muted text-[14px] leading-[21px] mt-2">
          The eight characters your friend sent you.
        </Text>
      </View>

      {/* Sized for a code being copied off someone else's screen, and spaced
          so a letter can be checked against the one beside it. */}
      <TextInput
        value={code}
        onChangeText={(next) =>
          setCode(next.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        }
        placeholder="ABCD2345"
        placeholderTextColor={COLORS.line}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={CODE_LENGTH}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => {
          if (ready) join();
        }}
        returnKeyType="go"
        accessibilityLabel="Invite code"
        style={{
          fontFamily: "PlusJakartaSans_700Bold",
          fontSize: 30,
          letterSpacing: 6,
          textAlign: "center",
          color: COLORS.ink,
          paddingVertical: 18,
          borderBottomWidth: 1,
          borderBottomColor: focused ? COLORS.primary : COLORS.line,
        }}
      />

      {error ? (
        <Notice
          tone={toneForError(error)}
          // A code that does not work is the one failure here that might be
          // the student's typing — so it says what to check without ever
          // saying they got it wrong. Most of the time it is a plan that has
          // lapsed or a seat somebody else took first.
          title="That code didn't get you in"
          message={`${error} Check it against the one your friend sent, or ask them whether the plan is still running.`}
          onDismiss={() => setError("")}
        />
      ) : null}

      <Button
        label="Join"
        busyLabel="Checking the code…"
        busy={busy}
        disabled={!ready}
        onPress={join}
      />
    </Screen>
  );
}
