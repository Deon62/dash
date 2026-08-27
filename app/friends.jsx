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
import { confirmCheckout, startCheckout } from "@/lib/checkout";
import { createGroup, loadGroup, removeMember } from "@/lib/billing";
import {
  SubscriptionTier,
  planFor,
  pricePerSeat,
  seatsFor,
} from "@/theme/plans";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

const FRIENDS = SubscriptionTier.FRIENDS;

/** Loose on purpose: the mail app is the real validator. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The rules of the plan, numbered.
 *
 * Money shared between five students raises questions the price does not
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

  const [confirming, setConfirming] = useState(false);
  /** The reference the server minted, so the sheet can verify rather than ask. */
  const [paymentReference, setPaymentReference] = useState(null);
  /** `{ tone, title, message, retry }`, or null. See `Notice`. */
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");

  const plan = planFor(FRIENDS);
  const seats = seatsFor(FRIENDS);
  const perSeat = pricePerSeat(FRIENDS);
  const solo = planFor(SubscriptionTier.PRO);

  const members = group?.members ?? [];
  const onPlan = activeTier(subscription) === FRIENDS && Boolean(group?.inviteCode);
  const owns = onPlan && (members.find((member) => member.isMe)?.isOwner ?? true);

  // The server counts the taken seats; the member list is only what it sent.
  const left = Math.max(0, seats - (group?.seatsTaken ?? members.length));
  const invite = group?.inviteCode ?? "";
  const payer = members.find((member) => member.isOwner);

  // The code and the seat list are the server's. Re-read on open so a friend
  // who joined an hour ago is on the list rather than appearing at the next
  // cold start.
  useEffect(() => {
    loadGroup();
  }, []);

  const pay = async () => {
    impact("medium");
    setNotice(null);

    // Minted by the server for this student — see `src/lib/checkout.js`. The
    // fixed payment link this replaced produced a charge that named nobody.
    const { reference, error } = await startCheckout(FRIENDS);

    if (error) {
      setNotice({
        tone: toneForError(error),
        title: "We couldn't open the payment page",
        message: `${error} Nothing has been charged.`,
        retry: pay,
      });
      return;
    }

    setPaymentReference(reference);
    // Nothing here can see a charge, so it asks rather than assuming.
    setConfirming(true);
  };

  /**
   * Confirms the payment, then asks the server for the group.
   *
   * The invite code comes from the server, not from this device. A code minted
   * here would be one nobody else could redeem — the seats it claims to give
   * away live on the account, and only the server can hand them out.
   */
  const startGroup = async () => {
    setBusy(true);
    const { error, pending } = await confirmCheckout(paymentReference);

    if (error) {
      setBusy(false);
      // The sheet closes over the answer otherwise, and a student would have to
      // dismiss the question to read the reply to it.
      setConfirming(false);

      setNotice(
        pending
          ? {
              tone: "waiting",
              title: "Your payment is still clearing",
              message:
                "Mobile money can take a minute or two to confirm. Nothing has gone wrong — check again shortly and the group is yours as soon as it lands.",
              retry: startGroup,
            }
          : {
              tone: toneForError(error),
              title: "We couldn't confirm that payment",
              message: `${error} If you were charged, the payment is safe and the group will appear on its own once it reaches us.`,
              retry: startGroup,
            }
      );
      return;
    }

    // Creating the group is separate from paying for it: the payment grants
    // the seats, this is what produces the code that gives them out.
    const created = await createGroup();
    setBusy(false);

    if (created.error) {
      setConfirming(false);
      setNotice({
        tone: toneForError(created.error),
        title: "Your payment went through, but the group didn't open",
        message: `${created.error} You have not lost anything — try again and your seats will be there.`,
        retry: startGroup,
      });
      return;
    }

    setPaymentReference(null);
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
      "Hey — I pay for an ALS Friends plan and there is a seat on it for you.",
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
        `Join my ALS plan — we each pay KES ${perSeat} a month instead of ` +
        `${solo.priceKsh}. Open ALS, go to Plans, tap Join with a code and ` +
        `enter ${invite}.`,
    });
  };

  return (
    <>
      <Screen bare>
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
                  `You pay KES ${plan.priceKsh} a month. The other ${seats - 1} pay nothing.`,
                  `Anyone who enters your code gets everything in ${solo.name}, for as long as the plan runs.`,
                  "Invite by email or send the code — either way it is the same code, and it works until the seats run out.",
                  "Remove someone and their seat frees up straight away for the next person.",
                  "Their notes, chats and grades stay private. You pay for the plan, not for their work.",
                  "If the plan lapses, everyone on it drops to the free limits together.",
                ]
              : onPlan
                ? [
                    `${payer?.name || "Whoever invited you"} pays. There is nothing for you to pay, now or later.`,
                    `You get everything in ${solo.name} for as long as they keep the plan running.`,
                    "Your notes, chats and grades are yours alone — nobody else on the plan can see them.",
                    "If they stop paying or free your seat, you drop to the free limits. Your work stays.",
                  ]
                : [
                    `One payment of KES ${plan.priceKsh} covers ${seats} students — KES ${perSeat} each.`,
                    "Whoever pays gets a code and hands it to the other four.",
                    `Everyone on it gets ${solo.name} in full. Nobody's notes are shared.`,
                    "The payer can free a seat at any time and give it to someone else.",
                  ]
          }
        />

        {onPlan ? null : (
          <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
            Payment goes through Kora, which takes M-Pesa, Airtel Money and
            cards.
          </Text>
        )}

      </Screen>

      {/* --- Did the payment land? ------------------------------------ */}
      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Did the payment go through?"
        subtitle={`Tap below and we will check it against our records. If Kora took KES ${plan.priceKsh}, the group and its code are yours.`}
      >
        <View className="gap-y-3">
          <Button
            label="Yes, give me the code"
            busyLabel="Checking…"
            busy={busy}
            disabled={busy}
            onPress={startGroup}
          />
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
              message: `${error} They are still on the plan — try again in a moment.`,
              retry: () => setRemoving(target),
            });
          }
        }}
      />
    </>
  );
}
