import { useEffect, useState } from "react";
import { Linking, Pressable, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Check,
  Copy,
  Plus,
  Share2,
  UserMinus,
  UserRound,
  Users,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import TextField from "@/components/TextField";
import ConfirmDialog from "@/components/ConfirmDialog";
import Notice, { toneForError } from "@/components/Notice";
import Disc from "@/components/Disc";
import { useStudyStore } from "@/store/useStudyStore";
import { activeTier } from "@/lib/quota";
import { ensureGroup, loadGroup, removeMember } from "@/lib/billing";
import {
  SubscriptionTier,
  cardFor,
  isSeason,
  planFor,
  pricePerMonth,
  pricePerSeat,
  seatsFor,
} from "@/theme/plans";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";
import { pullSync } from "@/lib/sync";

const FRIENDS = SubscriptionTier.FRIENDS;

/** Loose on purpose: the mail app is the real validator. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The rules of the plan, numbered.
 *
 * Money shared between six students raises questions the price does not
 * answer — who pays, what happens to my notes, what if they stop. Left
 * unanswered they get asked in the group chat and answered wrongly, so they
 * are answered here, in the fewest words that are still true.
 */
function HowItWorks({ items }) {
  return (
    <View>
      <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-3.5">
        HOW IT WORKS
      </Text>

      <View className="gap-y-3">
        {items.map((item, index) => (
          <View key={item} className="flex-row">
            <Text className="font-jk-med text-muted text-[12.5px] w-5">
              {index + 1}
            </Text>
            <Text className="font-jk text-muted text-[13px] leading-[20px] flex-1">
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The Friends plan: one payment, six seats.
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

  /** `{ tone, title, message, retry }`, or null. See `Notice`. */
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");

  /**
   * The Friends tier this student is actually on, or the monthly one.
   *
   * Friends is sold in two lengths and they are separate tiers, so every
   * number on this screen — the price, what each person paid, what it says in
   * the share message — has to come from the one they hold. Falling back to
   * monthly is right for the third state below, where nothing has been bought
   * yet and the plans screen is where a Season is chosen.
   */
  const held = cardFor(activeTier(subscription))?.family === "friends"
    ? activeTier(subscription)
    : FRIENDS;

  const plan = planFor(held);
  const seats = seatsFor(held);
  const perSeat = pricePerSeat(held);
  // Per person per month, which is the figure that means anything next to
  // Synapse's own monthly price.
  const perSeatMonthly = Math.round(pricePerMonth(held) / Math.max(1, seats));
  const solo = planFor(SubscriptionTier.PRO);

  const members = group?.members ?? [];
  const onPlan =
    cardFor(activeTier(subscription))?.family === "friends" &&
    Boolean(group?.inviteCode);
  const owns = onPlan && (members.find((member) => member.isMe)?.isOwner ?? true);

  // The server counts the taken seats; the member list is only what it sent.
  const left = Math.max(0, seats - (group?.seatsTaken ?? members.length));
  const invite = group?.inviteCode ?? "";
  const payer = members.find((member) => member.isOwner);

  /**
   * The code and the seat list are the server's, re-read on open — and the
   * group is opened here if the payment bought one and nothing has.
   *
   * Paying and having a group are separate facts. `ensureGroup` runs on the
   * payment path, but not every payment finishes there: a card page left open
   * on a phone Android then kills is settled minutes later by the server's own
   * sweep, with the app nowhere near it. That student is on a Friends plan with
   * six seats and no way to hand any of them out, and this screen is exactly
   * where they come looking.
   *
   * Safe to run every time. `ensureGroup` reads before it creates, so an
   * account that already has a code keeps the one it gave to five friends.
   */
  const owedGroup =
    cardFor(activeTier(subscription))?.family === "friends" && !group?.inviteCode;

  useEffect(() => {
    if (owedGroup) ensureGroup();
    else loadGroup();
  }, [owedGroup]);

  // The seat list is the server's, and it is the thing a student pulls down to
  // check — a friend who redeemed the code an hour ago should appear on the
  // gesture rather than at the next cold start.
  const refresh = () => Promise.all([pullSync(), loadGroup()]);

  /**
   * Into the payment screen, rather than straight out to a browser.
   *
   * The same route the plans screen uses, and for the same reason: paying is no
   * longer one hosted page. M-Pesa is an STK prompt this app requests and polls;
   * only a card leaves for a browser. Neither belongs on a screen about seats.
   *
   * The group is not created here any more either. `ensureGroup` runs on the
   * payment path itself, so six seats and an invite code exist however the
   * Friends plan was bought — including from the plans screen, which could
   * always sell it and never opened a group afterwards.
   */
  const pay = () => {
    impact("medium");
    setNotice(null);
    router.push(`/pay?tier=${FRIENDS}`);
  };

  const copy = async () => {
    impact("light");
    await Clipboard.setStringAsync(invite);
    setCopied(true);
    // Reverts on its own — a "Copied" that never leaves stops meaning anything
    // by the second tap.
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Hands the invite to the student's own mail app, already written.
   *
   * Not sent from here. Sending on someone's behalf needs a mail service the
   * server does not have yet, and an invite that arrives from an address the
   * recipient recognises gets opened — one from a no-reply gets binned. They
   * press send.
   */
  const sendInvite = async () => {
    const address = email.trim().toLowerCase();

    const subject = "A seat on my ALS plan";
    const body = [
      "Hey, I pay for an ALS Friends plan and there is a seat on it for you.",
      'Open ALS, go to Plans, tap "Join with a code" and enter:',
      invite,
      `That is everything in ${solo.name}, and nothing for you to pay.`,
    ].join("\n\n");

    const url =
      // Encoded, but with the @ put back: a raw address is what every mail
      // client expects, while encoding the rest stops an address containing
      // ? or & from injecting headers of its own.
      `mailto:${encodeURIComponent(address).replace(/%40/g, "@")}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(url);
      // The seat list is not touched. An invite that has been sent is not a
      // seat that has been taken — the friend still has to enter the code, and
      // showing them on the plan before they have would be a count that
      // disagrees with the one the server enforces.
      notify("success");
      setInviting(false);
      setEmail("");
    } catch {
      setInviting(false);
    }
  };

  const share = async () => {
    impact("medium");
    await Share.share({
      message:
        `Join my ALS plan. We each pay KES ${perSeatMonthly} a month instead of ` +
        `${solo.priceKsh}. Open ALS, go to Plans, tap Join with a code and ` +
        `enter ${invite}.`,
    });
  };

  return (
    <>
      <Screen bare onRefresh={refresh}>
        <ScreenHeader title="Friends" />

        {/* Under the heading for the same reason as on the plans page: this is
            the answer to something the student just did, and the rest of this
            screen is long. */}
        {notice ? (
          <Notice
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            actionLabel={busy ? undefined : "Try again"}
            onAction={notice.retry}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

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
              {/* No paragraph here: the numbered rules below say all of it,
                  and saying it twice on one screen is how a page stops being
                  read. */}
              <Text className="font-jk-semi text-ink text-[17px]">
                Pay for the group
              </Text>

              <View className="mt-4">
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
            <View className="flex-row items-center justify-between mb-1">
              <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px]">
                ON THIS PLAN · {members.length}/{seats}
              </Text>

              {/* On the list it adds to, rather than in the header: this is
                  the only place on the screen where "add a person" means
                  anything, and a seat that is already full has nothing to
                  add. */}
              {owns && left > 0 ? (
                <Pressable
                  onPress={() => {
                    impact("light");
                    setInviting(true);
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Invite someone by email"
                  className="active:opacity-60"
                >
                  <Disc size={32}>
                    <Plus size={16} color={COLORS.ink} strokeWidth={2} />
                  </Disc>
                </Pressable>
              ) : null}
            </View>

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

        {/* Three different sets of rules, because the answers genuinely
            differ depending on whose money is paying. */}
        <HowItWorks
          items={
            owns
              ? [
                  isSeason(held)
                    ? `You pay KES ${plan.priceKsh} for four months. The other ${seats - 1} pay nothing.`
                    : `You pay KES ${plan.priceKsh} a month. The other ${seats - 1} pay nothing.`,
                  `Anyone who enters your code gets everything in ${solo.name}, for as long as the plan runs.`,
                  "Invite by email or send the code. Either way it is the same code, and it works until the seats run out.",
                  "Remove someone and their seat frees up straight away for the next person.",
                  "Their notes, chats and grades stay private. You pay for the plan, not for their work.",
                  "If the plan lapses, everyone on it drops to the free limits together.",
                ]
              : onPlan
                ? [
                    `${payer?.name || "Whoever invited you"} pays. There is nothing for you to pay, now or later.`,
                    `You get everything in ${solo.name} for as long as they keep the plan running.`,
                    "Your notes, chats and grades are yours alone. Nobody else on the plan can see them.",
                    "If they stop paying or free your seat, you drop to the free limits. Your work stays.",
                  ]
                : [
                    `One payment of KES ${plan.priceKsh} covers ${seats} students, at KES ${perSeat} each.`,
                    "Whoever pays gets a code and hands it to the other four.",
                    `Everyone on it gets ${solo.name} in full. Nobody's notes are shared.`,
                    "The payer can free a seat at any time and give it to someone else.",
                  ]
          }
        />

        {onPlan ? null : (
          <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
            Pay with M-Pesa or a card.
          </Text>
        )}

      </Screen>

      {/* --- Invite by email ------------------------------------------ */}
      <Sheet
        visible={inviting}
        onClose={() => {
          setInviting(false);
          setEmail("");
        }}
        title="Invite a friend"
        subtitle="Your mail app opens with the invite and the code already written. You press send."
      >
        <View className="gap-y-4">
          <TextField
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="friend@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            autoFocus
          />

          <Button
            label="Send invite"
            disabled={!EMAIL.test(email.trim())}
            onPress={sendInvite}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={Boolean(removing)}
        title={`Remove ${removing?.name || "this person"}?`}
        message="Their seat frees up straight away. Their own notes are not affected."
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const target = removing;
          setRemoving(null);

          // The seat is the server's to free — it is what the next person's
          // join request is checked against.
          const { error } = await removeMember(target.id);
          if (error) {
            setNotice({
              tone: toneForError(error),
              title: "That seat could not be freed",
              message: `${error} They are still on the plan. Try again in a moment.`,
              retry: () => setRemoving(target),
            });
          }
        }}
      />
    </>
  );
}
