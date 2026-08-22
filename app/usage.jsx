import { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Receipt } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import UsageMeter from "@/components/UsageMeter";
import { useStudyStore } from "@/store/useStudyStore";
import { limitsFor, planName, unitCap } from "@/theme/plans";
import { activeTier, daysRemaining, rollUsage } from "@/lib/quota";
import { COLORS } from "@/theme/colors";

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
 * Built to fit one screen. The old version was four labelled lists you had to
 * scroll through and mentally diff against the plan; this is four bars you can
 * read in a glance, because "how much is left" is the only question anyone
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

  const tier = activeTier(subscription);
  const limits = limitsFor(tier);
  const usage = rollUsage(rawUsage);
  const left = daysRemaining(subscription);

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
  const weekly = quiz.interval === "weekly";

  return (
    <Screen bare>
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
        <Text className="font-jk-med text-ink text-[13px]">{planName(tier)}</Text>
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

        <UsageMeter
          label="AI questions today"
          used={usage.aiQueriesToday}
          limit={limits.dailyAiQueries}
        />
        <UsageMeter
          label={weekly ? "Quizzes this week" : "Quizzes taken"}
          used={weekly ? usage.quizzesThisWeek : usage.quizzesEver}
          limit={quiz.count}
        />
        <UsageMeter label="Course units" used={units.length} limit={unitCap(tier)} />
        <UsageMeter
          label="Scanned pages this month"
          used={usage.ocrPagesThisMonth}
          limit={limits.allowOcrScans ? limits.monthlyOcrPageLimit : 0}
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
