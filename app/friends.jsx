import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Check, Copy, Share2, UserMinus, UserRound, Users } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import Disc from "@/components/Disc";
import { useStudyStore } from "@/store/useStudyStore";
import { activeTier } from "@/lib/quota";
import { newInviteCode } from "@/lib/inviteCode";
import {
  PLAN_CARDS,
  SubscriptionTier,
  planFor,
  pricePerSeat,
  seatsFor,
} from "@/theme/plans";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

const FRIENDS = SubscriptionTier.FRIENDS;

/**
 * The Friends plan: one payment, five seats.
 *
 * What this screen shows depends on how the student got here, and there are
 * three ways:
 *
 *  1. **They paid** — the code and the seat list are the whole screen.
 *  2. **They joined** — a friend pays, so there is nothing to hand out and
 *     nothing to manage. It just says whose plan they are on.
 *  3. **Neither** — reached the route without a plan. Pay, or go enter a code.
 *
 * Only the payer sees the code. A member passing it on would be giving away
 * seats somebody else bought.
 */
export default function FriendsScreen() {
  const router = useRouter();

  const subscription = useStudyStore((state) => state.subscription);
  const group = useStudyStore((state) => state.group);
  const setGroup = useStudyStore((state) => state.setGroup);
  const removeGroupMember = useStudyStore((state) => state.removeGroupMember);
  const activatePlan = useStudyStore((state) => state.activatePlan);
  const profile = useStudyStore((state) => state.profile);

  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(null);

  const plan = planFor(FRIENDS);
  const seats = seatsFor(FRIENDS);
  const perSeat = pricePerSeat(FRIENDS);
  const solo = planFor(SubscriptionTier.PRO);

  const members = group?.members ?? [];
  const onPlan = activeTier(subscription) === FRIENDS && Boolean(group?.inviteCode);
  const owns = onPlan && (members.find((member) => member.id === "me")?.isOwner ?? true);

  const left = Math.max(0, seats - members.length);
  const invite = group?.inviteCode ?? "";
  const payer = members.find((member) => member.isOwner);

  const checkoutUrl = PLAN_CARDS.find((card) => card.tier === FRIENDS)?.checkoutUrl;

  const pay = async () => {
    impact("medium");
    // The system browser, not a WebView: this is a real payment page and the
    // student should be able to see the address bar it is entered on.
    await WebBrowser.openBrowserAsync(checkoutUrl);
    // Nothing here can see a charge, so it asks rather than assuming.
    setConfirming(true);
  };

  const startGroup = () => {
    activatePlan(FRIENDS);
    setGroup({
      inviteCode: newInviteCode(),
      seats,
      members: [{ id: "me", name: profile.name || "You", isOwner: true }],
    });
    notify("success");
    setConfirming(false);
  };

  const copy = async () => {
    impact("light");
    await Clipboard.setStringAsync(invite);
    setCopied(true);
    // Reverts on its own — a "Copied" that never leaves stops meaning anything
    // by the second tap.
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    impact("medium");
    await Share.share({
      message:
        `Join my ALS plan — we each pay KES ${perSeat} a month instead of ` +
        `${solo.priceKsh}. Open ALS, go to Plans, tap Join with a code and ` +
        `enter ${invite}.`,
    });
  };

  return (
    <>
      <Screen bare>
        <ScreenHeader title="Friends" />

        {owns ? (
          <>
            {/* --- 1. They paid ------------------------------------- */}
            {/* A rule under it, not a box around it — the same hairline the
                unit list and the settings rows use, so the code reads as part
                of the page rather than a widget dropped onto it. */}
            <View>
              <Pressable
                onPress={copy}
                accessibilityRole="button"
                accessibilityLabel={`Copy invite code ${invite}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.line,
                }}
                className="active:opacity-60"
              >
                {/* Letter-spaced because this gets read aloud across a lecture
                    hall and typed from a screenshot. */}
                <Text className="font-jk-semi text-ink text-[19px] tracking-[3px] flex-1">
                  {invite}
                </Text>
                {copied ? (
                  <Check size={17} color={COLORS.primary} strokeWidth={2.2} />
                ) : (
                  <Copy size={17} color={COLORS.muted} strokeWidth={1.8} />
                )}
              </Pressable>

              <Text className="font-jk text-muted text-[12px] mt-2.5">
                {copied
                  ? "Copied"
                  : left > 0
                    ? `${left} ${left === 1 ? "seat" : "seats"} left`
                    : "All seats taken"}
              </Text>
            </View>

            <Button label="Share the code" onPress={share} Icon={Share2} />
          </>
        ) : onPlan ? (
          <>
            {/* --- 2. They joined ----------------------------------- */}
            <View className="py-6">
              <Text className="font-jk-semi text-ink text-[17px]">
                You are on {payer?.name || "someone"}&apos;s plan
              </Text>
              <Text className="font-jk text-muted text-[13px] leading-[19px] mt-2">
                Everything in {solo.name}, nothing to pay.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* --- 3. Neither --------------------------------------- */}
            <View>
              <Text className="font-jk-semi text-ink text-[17px]">
                Pay for the group
              </Text>
              <Text className="font-jk text-muted text-[13px] leading-[19px] mt-2">
                KES {plan.priceKsh} a month, split {seats} ways — {perSeat} each
                for everything in {solo.name}. You pay, then hand out a code.
              </Text>

              <View className="mt-5">
                <Button
                  label={`Pay KES ${plan.priceKsh}`}
                  onPress={pay}
                  Icon={Users}
                />
              </View>
            </View>

            <View className="border-t border-line pt-6">
              <Text className="font-jk text-muted text-[13px] leading-[19px]">
                If a friend already paid, they have a code for you.
              </Text>

              <View className="mt-4 self-start">
                <Button
                  label="Join with a code"
                  variant="soft"
                  onPress={() => {
                    impact("light");
                    router.push("/join");
                  }}
                />
              </View>
            </View>
          </>
        )}

        {onPlan ? (
          <View>
            <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
              ON THIS PLAN · {members.length}/{seats}
            </Text>

            {members.map((member, index) => (
              <View
                key={member.id}
                className={`flex-row items-center py-3.5 ${
                  index === members.length - 1 ? "" : "border-b border-hairline"
                }`}
              >
                <Disc size={36}>
                  <UserRound size={16} color={COLORS.ink} strokeWidth={1.8} />
                </Disc>

                <View className="flex-1 ml-3.5">
                  <Text className="font-jk-med text-ink text-[14.5px]">
                    {member.name || "Someone"}
                  </Text>
                  {member.isOwner ? (
                    <Text className="font-jk text-muted text-[12px] mt-0.5">
                      Pays for this plan
                    </Text>
                  ) : null}
                </View>

                {/* Seats are the payer's to give back. And the payer is never
                    removable: the plan would outlive them. */}
                {owns && !member.isOwner ? (
                  <Pressable
                    onPress={() => {
                      impact("light");
                      setRemoving(member);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.name || "this person"}`}
                    className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
                  >
                    <UserMinus size={16} color={COLORS.danger} strokeWidth={1.8} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Only where it is load-bearing: before paying. Once the plan is
            running, a paragraph about card processors is furniture. */}
        {onPlan ? null : (
          <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
            Payment goes through Paystack, which takes M-Pesa, Airtel Money and
            cards.
          </Text>
        )}

      </Screen>

      {/* --- Did the payment land? ------------------------------------ */}
      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Did the payment go through?"
        subtitle={`We can't confirm it from here yet. If Paystack charged you KES ${plan.priceKsh}, unlock the group now and it will be reconciled once accounts are connected.`}
      >
        <View className="gap-y-3">
          <Button label="Yes, give me the code" onPress={startGroup} />
          <Pressable
            onPress={() => {
              impact("light");
              setConfirming(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Not yet"
            className="items-center py-3 active:opacity-60"
          >
            <Text className="font-jk-med text-muted text-[14px]">Not yet</Text>
          </Pressable>
        </View>
      </Sheet>

      <ConfirmDialog
        visible={Boolean(removing)}
        title={`Remove ${removing?.name || "this person"}?`}
        message="Their seat frees up straight away. Their own notes are not affected."
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          removeGroupMember(removing.id);
          setRemoving(null);
        }}
      />
    </>
  );
}
