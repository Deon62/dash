import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Receipt } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import UsageMeter from "@/components/UsageMeter";
import { useStudyStore } from "@/store/useStudyStore";
import { loadUsage } from "@/lib/account";
import { UNLIMITED, limitsFor, planName, unitCap } from "@/theme/plans";
import { activeTier, daysRemaining, rollUsage } from "@/lib/quota";
import { COLORS } from "@/theme/colors";
import { pullSync } from "@/lib/sync";
import { useRefillCountdown } from "@/lib/useRefillCountdown";

/**
 * One line: what it counts on the left, the number on the right.
 *
 * A list down one column beats a grid of tiles here — these six figures are
 * not comparable to each other, so laying them out side by side invited a
 * comparison that means nothing.
 */
function Figure({ label, value, last = false }) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      <Text className="font-jk text-ink text-[14px]">{label}</Text>
      <Text className="font-jk-med text-ink text-[14px]">{value}</Text>
    </View>
  );
}

/**
 * What the plan allows, and how much of it is gone.
 *
 * The meters are the server's. They have to be: the server is what refuses a
 * question at the limit, and a bar drawn from a device's own tally would say
 * three left on the very screen a student opens to find out why they were
 * turned down. The device's counters are the fallback, for the first render
 * and for no connection.
 *
 * Built to fit one screen — "how much is left" is the only question anyone
 * opens this page with.
 */
export default function UsageScreen() {
  const router = useRouter();

  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const chats = useStudyStore((state) => state.chats);
  const events = useStudyStore((state) => state.events);
  const study = useStudyStore((state) => state.study);
  const subscription = useStudyStore((state) => state.subscription);
  const rawUsage = useStudyStore((state) => state.usage);
  const serverUsage = useStudyStore((state) => state.serverUsage);

  const tier = activeTier(subscription);
  const limits = limitsFor(tier);
  const usage = rollUsage(rawUsage);
  const left = daysRemaining(subscription);

  // Re-read on open rather than trusting whatever the last sync left behind: a
  // student lands here straight after being refused, and a stale bar is the
  // one thing this screen must not show.
  useEffect(() => {
    loadUsage();
  }, []);

  /**
   * Pull to refresh, and it does more than sync.
   *
   * The meters on this page come from the server, not from the local tally —
   * so a plain `pullSync` would push and pull coursework and leave the one
   * thing the student pulled down to check exactly as stale as it was.
   */
  const refresh = () => Promise.all([pullSync(), loadUsage()]);

  const live = materials.filter((material) => !material.archived);

  const words = useMemo(
    () =>
      live.reduce(
        (total, material) => total + material.body.split(/\s+/).filter(Boolean).length,
        0
      ),
    [live]
  );

  const questions = chats.reduce(
    (total, chat) => total + chat.messages.filter((m) => m.role === "student").length,
    0
  );

  const quiz = limits.quizzesPerInterval;
  const monthly = (serverUsage?.quizInterval ?? quiz.interval) === "monthly";

  /**
   * A meter the server sent, or the device's own count of the same thing.
   *
   * `resetsAt` only ever comes from the server. With no date the countdown
   * falls back to the 1st of next month, which is the same answer — until a
   * plan's own clock disagrees with the calendar's, and then the server's is
   * the one that decides.
   */
  const meter = (name, used, limit) => {
    const remote = serverUsage?.[name];
    if (!remote) return { used, limit, resetsAt: null };
    return {
      used: remote.used,
      limit: remote.unlimited ? UNLIMITED : remote.limit,
      resetsAt: remote.resetsAt ?? null,
    };
  };

  const ai = meter(
    "aiQueriesThisMonth",
    usage.aiQueriesThisMonth,
    limits.monthlyAiQueries,
  );
  const quizzes = meter(
    "quizzes",
    monthly ? usage.quizzesThisMonth : usage.quizzesEver,
    quiz.count,
  );
  const courseUnits = meter("courseUnits", units.length, unitCap(tier));

  // Ticking, so a screen left open does not sit on "1 day" into the new month.
  const refillsIn = useRefillCountdown(ai.resetsAt);

  // Free is the only plan with a ceiling that does not refill, and it is the
  // number that decides when the app stops answering — so it is drawn, and
  // drawn above the monthly one, which is the less important of the two once
  // it starts running out.
  const totalAi = meter(
    "aiQueriesTotal",
    // The device's own counter, not the number of questions in the chat list:
    // a student who clears a conversation has not been given the questions
    // back, and the server's meter -- which wins here whenever it has arrived
    // -- knows that.
    usage.aiQueriesEver,
    limits.lifetimeAiQueries,
  );
  const hasLifetimeCeiling =
    totalAi.limit !== UNLIMITED && totalAi.limit > 0;

  return (
    <Screen bare onRefresh={refresh}>
      <ScreenHeader
        title="Usage"
        right={
          <IconButton
            Icon={Receipt}
            label="Plans and billing"
            onPress={() => router.push("/billing")}
          />
        }
      />

      {/* Plan and time left, as one quiet line. It was a filled card, which
          made the least actionable thing on the page the loudest. */}
      <View className="flex-row items-center gap-x-2 -mt-3">
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary }}
        />
        <Text className="font-jk-med text-ink text-[13px]">
          {serverUsage?.planName ?? planName(tier)}
        </Text>
        {left !== null ? (
          <Text className="font-jk text-muted text-[13px]">
            · {left} {left === 1 ? "day" : "days"} left
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-3">
          ALLOWANCE
        </Text>

        {hasLifetimeCeiling ? (
          <UsageMeter
            label="AI questions on the free plan"
            used={totalAi.used}
            limit={totalAi.limit}
          />
        ) : null}
        {/* The monthly meter is the only one that says when it refills. A
            student reads this bar to find out whether to wait or to pay, and
            "380 / 400" alone answers neither. Days until the 1st, down to
            hours and minutes on the last day, because by then the answer has
            turned into "tonight". */}
        <UsageMeter
          label="AI questions this month"
          used={ai.used}
          limit={ai.limit}
          note={ai.limit === UNLIMITED ? null : `Refills in ${refillsIn}`}
        />
        <UsageMeter
          label={monthly ? "Quizzes this month" : "Quizzes taken"}
          used={quizzes.used}
          limit={quizzes.limit}
        />
        <UsageMeter
          label="Course units"
          used={courseUnits.used}
          limit={courseUnits.limit}
          last
        />
      </View>

      <View>
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-3">
          WHAT YOU HAVE BUILT
        </Text>

        <Figure label="Items filed" value={live.length} />
        {/* Words, not megabytes: the tutor searches text, so text is the
            capacity that actually matters. */}
        <Figure label="Words the tutor can read" value={words.toLocaleString()} />
        <Figure label="Archived" value={materials.length - live.length} />
        <Figure label="Questions asked" value={questions} />
        <Figure label="Events tracked" value={events.length} />
        <Figure
          label="Current streak"
          value={`${study.streakDays} ${study.streakDays === 1 ? "day" : "days"}`}
          last
        />
      </View>
    </Screen>
  );
}
