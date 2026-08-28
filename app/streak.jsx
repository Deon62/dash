import { useMemo } from "react";
import { Text, View } from "react-native";
import { Check, Flame } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import { useStudyStore } from "@/store/useStudyStore";
import { COLORS } from "@/theme/colors";
import { dayKey } from "@/lib/dates";

/** Monday-first, matching the calendar and every printed timetable. */
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The seven days of the week the student is currently in.
 *
 * Built from real dates rather than counting backwards from today, so the row
 * always reads Monday to Sunday — a "last 7 days" window would put a different
 * day on the left every morning and stop looking like a week.
 */
function weekDays(today = new Date()) {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((today.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { key: dayKey(date), letter: LETTERS[index] };
  });
}

function DayMark({ letter, done, isToday }) {
  const filled = done || isToday;

  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? COLORS.flame : COLORS.surface,
        // Today gets a ring whether or not it has been earned yet — it is the
        // one you can still do something about.
        borderWidth: isToday && !done ? 2 : 0,
        borderColor: COLORS.flame,
        opacity: isToday && !done ? 0.55 : 1,
      }}
    >
      {done ? (
        <Check size={18} color={COLORS.canvas} strokeWidth={3} />
      ) : (
        <Text
          style={{ color: filled ? COLORS.canvas : COLORS.muted }}
          className="font-jk-med text-[13px]"
        >
          {letter}
        </Text>
      )}
    </View>
  );
}

/**
 * The streak, on its own page.
 *
 * One number, big. Everything else on the screen exists to give it context:
 * which days of this week are already earned, and what the best run has been.
 * Nothing here is tappable — a page whose only job is to be encouraging should
 * not also be a menu.
 */
export default function StreakScreen() {
  const study = useStudyStore((state) => state.study);

  const days = study.days ?? [];
  const todayKey = dayKey();

  const week = useMemo(() => weekDays(), []);
  const earned = useMemo(() => new Set(days), [days]);

  const current = study.streakDays ?? 0;
  const longest = Math.max(study.longestStreak ?? 0, current);
  const revisedToday = earned.has(todayKey);

  const message = !current
    ? "Ask one question today and the streak starts."
    : revisedToday
      ? "Today is on the board. Keep it rolling."
      : "You haven't revised today. One question keeps it alive.";

  return (
    <Screen bare contentStyle={{ rowGap: 0 }}>
      <ScreenHeader />

      <View className="items-center pt-10">
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: current ? "#FFF4EC" : COLORS.surface,
          }}
        >
          <Flame
            size={44}
            color={current ? COLORS.flame : COLORS.muted}
            strokeWidth={1.6}
            fill={current ? COLORS.flame : "transparent"}
          />
        </View>

        {/* The number is the page. Everything else is caption. */}
        <Text className="font-jk-bold text-ink text-[72px] leading-[84px] mt-8">
          {current}
        </Text>
        <Text className="font-jk-bold text-ink text-[20px] -mt-1">
          {current === 1 ? "Day streak" : "Days streak"}
        </Text>

        <Text className="font-jk text-muted text-[13.5px] leading-[20px] text-center mt-3 px-6">
          {message}
        </Text>

        <View className="flex-row justify-center gap-x-2 mt-10">
          {week.map((day, index) => (
            <DayMark
              key={`${day.key}-${index}`}
              letter={day.letter}
              done={earned.has(day.key)}
              isToday={day.key === todayKey}
            />
          ))}
        </View>

        <Text className="font-jk text-muted text-[13px] mt-6">
          Longest streak:{" "}
          <Text className="font-jk-semi text-ink">
            {longest} {longest === 1 ? "day" : "days"}
          </Text>
        </Text>
      </View>
    </Screen>
  );
}
