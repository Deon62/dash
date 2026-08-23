import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import { useStudyStore } from "@/store/useStudyStore";
import { SubscriptionTier, seatsFor } from "@/theme/plans";
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

  const setGroup = useStudyStore((state) => state.setGroup);
  const activatePlan = useStudyStore((state) => state.activatePlan);
  const profile = useStudyStore((state) => state.profile);

  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);

  const ready = code.length === CODE_LENGTH;

  const join = () => {
    notify("success");

    // Local until the join endpoint is wired: the seat is real when the server
    // says so, and a pull replaces this wholesale.
    activatePlan(SubscriptionTier.FRIENDS);
    setGroup({
      inviteCode: code,
      seats: seatsFor(SubscriptionTier.FRIENDS),
      members: [
        { id: "owner", name: "Whoever invited you", isOwner: true },
        { id: "me", name: profile.name || "You", isOwner: false },
      ],
    });

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

      <Button label="Join" disabled={!ready} onPress={join} />
    </Screen>
  );
}
