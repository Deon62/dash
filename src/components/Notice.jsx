import { Pressable, Text, View } from "react-native";
import { CloudOff, Clock, Info, TriangleAlert } from "lucide-react-native";

import Disc from "@/components/Disc";
import { OFFLINE } from "@/api/client";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * How the app says something went wrong.
 *
 * Every failure in the app used to be one line of small red text at the foot of
 * a page — the least visible thing on screen for the most important thing it
 * had to say. Someone who has just paid and been told nothing worked would find
 * it below the fold, in the smallest type on the page, if they found it at all.
 *
 * So a failure gets a card: an icon, a heading that names what happened, and
 * the detail underneath. It is not painted red. Red fills read as an accusation
 * across a whole card, and almost none of these are the student's doing — a
 * cold server, a dropped connection, a mobile-money confirmation still in
 * flight. The icon carries the colour, the card sits on the same grey as every
 * other well in the app, and the words do the rest.
 *
 * The headings matter as much as the layout. "Something went wrong on our end"
 * is not politeness for its own sake — it is usually the literal truth, and a
 * student who thinks they broke something tries the same thing again instead of
 * waiting a moment or asking for help.
 */

/**
 * Which tone a raw error string deserves.
 *
 * Only one thing is worth telling apart automatically: a connection failure
 * has a different heading and a different fix from a server that answered
 * badly, and `src/api/client.js` produces exactly one message for it. Anything
 * else is left to the caller, which knows more than a string match ever will.
 */
export function toneForError(message) {
  return message === OFFLINE ? "offline" : "error";
}

const TONES = {
  /** Our fault, or nobody's. The default, because it usually is. */
  error: {
    Icon: TriangleAlert,
    color: COLORS.danger,
    title: "Something went wrong on our end",
  },
  /** Reachability. Distinct from `error` because the fix is different. */
  offline: {
    Icon: CloudOff,
    color: COLORS.muted,
    title: "We can't reach the server",
  },
  /** Nothing has failed yet — it just has not finished. */
  waiting: {
    Icon: Clock,
    color: COLORS.amber,
    title: "Still waiting on this",
  },
  info: {
    Icon: Info,
    color: COLORS.primary,
    title: "Worth knowing",
  },
};

/**
 * `message` is the only required prop — usually the server's own words, which
 * are already written for a student to read.
 *
 * `title` overrides the tone's heading where the screen knows something more
 * specific. `actionLabel`/`onAction` add the way out: a failure a student can
 * retry from where they are standing is a much smaller failure.
 */
export default function Notice({
  tone = "error",
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}) {
  if (!message) return null;

  const kind = TONES[tone] ?? TONES.error;
  const { Icon } = kind;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
      }}
      accessibilityRole="alert"
      accessibilityLabel={`${title ?? kind.title}. ${message}`}
    >
      <View className="flex-row">
        <Disc size={34} tone="none">
          <Icon size={19} color={kind.color} strokeWidth={1.8} />
        </Disc>

        <View className="flex-1 ml-2.5">
          <Text className="font-jk-semi text-ink text-[14.5px] leading-[20px]">
            {title ?? kind.title}
          </Text>
          <Text className="font-jk text-muted text-[13px] leading-[19px] mt-1.5">
            {message}
          </Text>

          {/* Both controls are text rather than buttons. A filled button here
              would compete with whatever the page is actually for — and on the
              plans page that is the thing the student came to press. */}
          {actionLabel || onDismiss ? (
            <View className="flex-row items-center gap-x-5 mt-3.5">
              {actionLabel ? (
                <Pressable
                  onPress={() => {
                    impact("light");
                    onAction?.();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                  hitSlop={8}
                  className="active:opacity-60"
                >
                  <Text className="font-jk-med text-primary text-[13.5px]">
                    {actionLabel}
                  </Text>
                </Pressable>
              ) : null}

              {onDismiss ? (
                <Pressable
                  onPress={() => {
                    impact("light");
                    onDismiss();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  hitSlop={8}
                  className="active:opacity-60"
                >
                  <Text className="font-jk-med text-muted text-[13.5px]">
                    Dismiss
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
