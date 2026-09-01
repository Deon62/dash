import { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Clock, TriangleAlert } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MastercardMark, VisaMark } from "@/components/CardMarks";
import PaymentArt from "@/components/PaymentArt";
import { useStudyStore } from "@/store/useStudyStore";
import { COLORS, TINTS } from "@/theme/colors";
import { getCountry, normalisePhone } from "@/theme/countries";
import { planFor, planName } from "@/theme/plans";
import {
  TIMED_OUT,
  finishRedirect,
  payByCard,
  startMpesa,
  useMpesaWatch,
} from "@/lib/payments";
import { impact, notify } from "@/lib/haptics";

/**
 * Paying for a plan: a number, or a card.
 *
 * M-Pesa is the page and cards are the way out of it, rather than two options
 * behind a chooser. That is not a preference — it is what the two integrations
 * are. An STK push is a request this app makes with a number the student types,
 * after which the payment happens on the SIM toolkit with nothing to redirect
 * to and nothing to come back from; a card is a hosted page you leave for and
 * return from. It also matches who uses them: nearly everybody pays with the
 * number already on their account, and a method picker would put a decision in
 * front of the nine in ten who only ever had one answer to it.
 *
 * No provider is named anywhere a student can read. Which processor handles
 * either method is the server's business and changes without an app release —
 * including the case where M-Pesa itself is unreachable and the server answers
 * with a hosted page instead. That student asked to pay with M-Pesa and is
 * paying with M-Pesa; the fallback is not theirs to know about.
 *
 * The rule the whole screen is built around: **never say a payment failed
 * unless the server said so in those words.** Not on a timeout, not on a closed
 * browser, not on a dropped connection. A student who was debited being told it
 * did not work is the worst thing this screen can produce.
 */

/**
 * The number field is only ever used for the one thing Daraja can reach.
 *
 * The dialling code is printed beside the field rather than typed into it, so
 * what the field holds is the *national* number — nine digits, no `+254`, no
 * leading zero. `normalisePhone` is what keeps it that way whatever gets pasted
 * or prefilled: the account stores numbers in full international form, and
 * dropping one straight into the field put a second country code on the screen
 * ("+254 254712345678") and would have sent one too.
 *
 * This is display normalisation, not validation. Nothing is refused here — the
 * server decides what it can reach, and the whole number is reassembled from
 * the code beside the field when it is sent.
 */
const KE = getCountry("KE");
const DIAL = KE.dial;

/**
 * Cards, as one button.
 *
 * The marks sit inside a single control rather than in a box each. Two outlined
 * rectangles read as two choices, and there is no choice here — the app is not
 * asking which scheme you hold, only whether you are paying by card at all.
 * Which network the number belongs to is something the provider's page works
 * out from the digits, long after this screen.
 *
 * Still the logos rather than the word "Card", because that is how the row gets
 * recognised: people look for the mark printed on the thing in their hand.
 */
function CardButton({ onPress, busy }) {
  return (
    <Pressable
      onPress={() => {
        if (busy) return;
        impact("light");
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Pay by card"
      accessibilityState={{ disabled: busy, busy }}
      style={{
        height: 54,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
        opacity: busy ? 0.5 : 1,
      }}
      className="active:opacity-70"
    >
      <VisaMark height={15} />
      {/* Tight, and no separator. A rule down the middle would put back the
          two-buttons reading that the single ground just removed. */}
      <View style={{ width: 12 }} />
      <MastercardMark height={22} />
    </Pressable>
  );
}

export default function PayScreen() {
  const router = useRouter();
  const { tier: tierParam } = useLocalSearchParams();

  const profile = useStudyStore((state) => state.profile);

  const tier = String(tierParam ?? "pro");
  const plan = planFor(tier);

  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);

  /** The STK payment in flight, from `POST /billing/mpesa`. */
  const [prompt, setPrompt] = useState(null);
  const [starting, setStarting] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState("");

  const { settled, timedOut } = useMpesaWatch(prompt?.reference ?? null);

  /**
   * Prefilled from the account, because it is nearly always the same number.
   *
   * Nearly, not always — paying off a parent's or a friend's line is ordinary,
   * so the field stays editable. Once, on arrival: repeating it would overwrite
   * a number somebody had deliberately typed over.
   */
  useEffect(() => {
    if (!profile?.phone || phone) return;
    setPhone(normalisePhone(profile.phone, KE));
  }, [profile?.phone]);

  useEffect(() => {
    if (settled?.status === "success") notify("success");
    else if (settled) notify("error");
  }, [settled]);

  /**
   * Enough digits to be worth sending, and nothing more.
   *
   * The server normalises `0712…`, `+254712…`, `254 712 345 678`, spaces and
   * hyphens alike, and refuses only a number that genuinely cannot receive a
   * prompt — with a sentence written for a student. Enforcing a format here
   * instead is how an app ends up refusing numbers that would have worked, so
   * this is a guard against an empty field rather than a validator.
   */
  const sendable = phone.length >= (KE.nsn ?? 9);

  const pay = async () => {
    if (!sendable || starting) return;

    impact("medium");
    setStarting(true);
    setError("");
    setWaiting("");

    // Sent in full international form, which the server lists among the shapes
    // it normalises — and which is unambiguous about the code shown on screen.
    const { payment, error: failed } = await startMpesa(tier, `${DIAL}${phone}`);

    setStarting(false);

    if (failed) {
      // The server's own words. It knows why a number cannot be reached and
      // this app does not.
      setError(failed);
      return;
    }

    /**
     * M-Pesa was unreachable, so the server opened a hosted page instead.
     *
     * Handled exactly like a card from here, and never described as anything
     * different: it is the same payment, and "we couldn't reach M-Pesa so
     * here is another page" is a sentence that loses a sale for no reason.
     */
    if (payment.mode === "redirect") {
      const result = await finishRedirect(payment, tier);
      settleBrowserResult(result);
      return;
    }

    setPrompt(payment);
  };

  const settleBrowserResult = ({ paid, pending, error: failed }) => {
    if (paid) {
      notify("success");
      router.back();
      return;
    }

    // Pending is not failure and must never be drawn as one — the sweep
    // settles anything that lands late.
    if (pending) setWaiting(TIMED_OUT);
    else if (failed) setError(failed);
  };

  const byCard = async () => {
    if (cardBusy) return;

    setCardBusy(true);
    setError("");
    setWaiting("");

    const result = await payByCard(tier);

    setCardBusy(false);
    settleBrowserResult(result);
  };

  /** A fresh attempt, and a fresh reference. One is never reused. */
  const again = () => {
    setPrompt(null);
    setError("");
    setWaiting("");
  };

  // --- Paid ----------------------------------------------------------------

  if (settled?.status === "success") {
    return (
      <Screen bare>
        <ScreenHeader title={planName(tier)} />
        <Done planLabel={planName(tier)} onDone={() => router.back()} />
      </Screen>
    );
  }

  // --- Waiting on the handset ----------------------------------------------

  if (prompt && !settled && !timedOut) {
    return <Waiting phone={prompt.phone} amount={plan.priceKsh} onCancel={again} />;
  }

  /**
   * Everything that went wrong, as one modal at a time.
   *
   * These were inline cards, and they were wrong twice over. A card pushes the
   * form down and then stays there, so a failure reads as part of the page
   * rather than as something that just happened — and the number field, the one
   * thing to act on, gets shoved down by the message telling you to act on it.
   * A modal arrives, is answered, and leaves.
   *
   * The order is not arbitrary: a server verdict outranks a timeout, which
   * outranks a request that never got started. Only one can be true at a time,
   * and showing the most specific is what stops a student dismissing two
   * dialogs to learn one thing.
   */
  const dialog =
    settled?.status === "failed"
      ? {
          // The server's own words, which name the fix — "You do not have
          // enough M-Pesa balance for that", "That PIN was wrong". A house
          // string here throws away the only useful part.
          Icon: TriangleAlert,
          tone: "danger",
          title: "That payment didn't go through",
          message: settled.message,
          confirmLabel: "Try again",
          onConfirm: again,
          cancelLabel: "Not now",
          onCancel: () => router.back(),
        }
      : timedOut || waiting
        ? {
            // Never drawn as a failure, and deliberately without a "try again":
            // starting a second payment is how somebody ends up charged twice
            // for a plan that was already paid for and merely slow to confirm.
            Icon: Clock,
            tone: "ink",
            title: "We haven't heard back yet",
            message: waiting || TIMED_OUT,
            confirmLabel: "OK",
            onConfirm: () => {
              setWaiting("");
              again();
            },
          }
        : error
          ? {
              Icon: TriangleAlert,
              tone: "danger",
              title: "We couldn't start that payment",
              message: `${error} Nothing has been charged.`,
              confirmLabel: "OK",
              onConfirm: () => setError(""),
            }
          : null;

  return (
    <Screen bare keyboardAware>
      <ScreenHeader title={planName(tier)} />

      {/* --- M-Pesa: a logo and a line ------------------------------------- */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: focused ? COLORS.primary : COLORS.line,
          paddingBottom: 10,
        }}
      >
        {/* The logo is the label. "M-PESA NUMBER" set above a line with the
            M-Pesa mark on it is the same word twice, and the mark is the
            faster read. */}
        <Image
          source={require("../assets/mpesa.png")}
          style={{ width: 62, height: 20 }}
          resizeMode="contain"
          accessibilityLabel="M-Pesa"
        />

        <Text className="font-jk-med text-muted text-[16px] ml-3">{DIAL}</Text>

        <TextInput
          value={phone}
          onChangeText={(next) => setPhone(normalisePhone(next, KE))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="712 345 678"
          placeholderTextColor={COLORS.faint}
          keyboardType="phone-pad"
          maxLength={KE.nsn}
          accessibilityLabel="M-Pesa number"
          style={{ flex: 1, paddingVertical: 0 }}
          className="font-jk text-ink text-[16px] ml-2"
        />
      </View>

      <Button
        label={`Pay KES ${plan.priceKsh.toLocaleString()}`}
        busyLabel="Sending the request…"
        busy={starting}
        disabled={!sendable || cardBusy}
        onPress={pay}
      />

      {/* --- Cards: the way out ---------------------------------------------
          A rule with a word in it rather than a heading. This is the smaller of
          the two paths and should read as an alternative, not as a second
          section competing with the first. */}
      <View className="flex-row items-center gap-x-3 mt-1">
        <View className="flex-1 h-[1px] bg-line" />
        <Text className="font-jk text-faint text-[12px]">or pay by card</Text>
        <View className="flex-1 h-[1px] bg-line" />
      </View>

      <CardButton onPress={byCard} busy={cardBusy || starting} />

      <ConfirmDialog
        visible={Boolean(dialog)}
        Icon={dialog?.Icon}
        iconTone={dialog?.tone}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        confirmLabel={dialog?.confirmLabel ?? "OK"}
        onConfirm={dialog?.onConfirm}
        cancelLabel={dialog?.cancelLabel}
        onCancel={dialog?.onCancel}
        onDismiss={dialog?.onConfirm}
      />
    </Screen>
  );
}

/**
 * The half of an STK push that belongs to the student.
 *
 * Its own screen, with nothing else on it. Not the form with a spinner over it
 * and not a card pushed in above the fields — for the thirty seconds this is up,
 * there is exactly one thing to do and it is happening on a different device.
 * A number field still sitting there invites an edit to something already in
 * flight, and a page of other controls invites a second tap on Pay.
 *
 * No header either, and no back arrow. The way out is the Cancel at the foot,
 * which is deliberate: leaving by the header would be a navigation, and this
 * screen has to be certain it stops watching a payment when it is dismissed.
 */
function Waiting({ phone, amount, onCancel }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.canvas,
        paddingTop: insets.top,
        paddingBottom: Math.max(insets.bottom, 16),
        paddingHorizontal: 28,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* The looping video where the binary has `expo-video` in it, and a
          pulsing handset everywhere else — so this screen ships over the air
          rather than waiting on a store build. See `PaymentArt`. */}
      <PaymentArt />

      <Text className="font-jk-semi text-ink text-[22px] text-center mt-6">
        Check your phone
      </Text>

      <Text className="font-jk text-muted text-[14.5px] leading-[22px] text-center mt-2.5">
        Enter your M-Pesa PIN to pay KES {amount.toLocaleString()}
        {phone ? `. Sent to ${phone}` : ""}.
      </Text>

      {/* The one instruction that is not about the handset. The app has to stay
          open for the poll to settle this, and a student who switches away to
          find the prompt is exactly who needs telling. */}
      <Text className="font-jk text-faint text-[12.5px] text-center mt-3">
        Keep this open — it can take a few seconds to arrive.
      </Text>

      {/* At the foot and quiet. It is a real way out and should not be hunted
          for, but it is not what anybody came here to press. */}
      <Pressable
        onPress={() => {
          impact("light");
          onCancel();
        }}
        accessibilityRole="button"
        accessibilityLabel="Cancel this payment"
        style={{ position: "absolute", bottom: Math.max(insets.bottom, 16) + 8 }}
        className="items-center py-3 px-6 active:opacity-60"
      >
        <Text className="font-jk-med text-muted text-[14px]">Cancel</Text>
      </Pressable>
    </View>
  );
}

/** Paid, and the plan is already on the device — the poll brought it back. */
function Done({ planLabel, onDone }) {
  return (
    <View className="items-center gap-y-3 pt-6">
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: TINTS.teal,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={24} color={COLORS.teal} strokeWidth={2.5} />
      </View>

      <Text className="font-jk-semi text-ink text-[17px]">Payment received</Text>
      <Text className="font-jk text-muted text-[13.5px]">
        {planLabel} is active.
      </Text>

      <View className="w-full mt-4">
        <Button label="Done" onPress={onDone} />
      </View>
    </View>
  );
}
