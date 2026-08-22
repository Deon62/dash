import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { COLORS, MARK_COLORS } from "@/theme/colors";
import { dayKey } from "@/lib/dates";
import { impact } from "@/lib/haptics";

/** Monday-first column headings, matching how a timetable is printed. */
const COLUMNS = ["M", "T", "W", "T", "F", "S", "S"];

/** Grid position of a weekday, Monday at 0 and Sunday at 6. */
function column(day) {
  return (day + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * A dot per kind of thing happening, capped.
 *
 * Three is the limit: a fourth dot makes the row wider than the date above it
 * and the grid starts to wobble. The order is fixed so the same kind of day
 * always looks the same.
 */
function Dots({ marks }) {
  const kinds = ["class", "cat", "exam", "assignment", "other"].filter(
    (kind) => marks[kind] > 0
  );

  if (kinds.length === 0) return <View className="h-1.5 mt-1" />;

  return (
    <View className="flex-row gap-x-[3px] h-1.5 mt-1">
      {kinds.slice(0, 3).map((kind) => (
        <View
          key={kind}
          style={{ backgroundColor: MARK_COLORS[kind] }}
          className="h-1.5 w-1.5 rounded-full"
        />
      ))}
    </View>
  );
}

/**
 * Month grid with a dot for everything on each day.
 *
 * The whole point is the shape of the month at a glance — where the exams
 * cluster, which week is empty. Detail belongs in the sheet a tap opens, not
 * on a 40-pixel cell.
 */
export default function MonthCalendar({ classes, events, onSelectDate }) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const todayKey = dayKey(today);

  // Classes repeat weekly, so they are counted per weekday once and reused for
  // every date in that column. Events are dated, so they are bucketed by day.
  const weeklyClasses = useMemo(() => {
    const table = new Map();
    for (const entry of classes) {
      table.set(entry.day, (table.get(entry.day) ?? 0) + 1);
    }
    return table;
  }, [classes]);

  const eventsByDay = useMemo(() => {
    const table = new Map();
    for (const event of events) {
      if (!event.at || event.done) continue;
      const key = dayKey(event.at);
      const bucket = table.get(key) ?? {};
      bucket[event.kind] = (bucket[event.kind] ?? 0) + 1;
      table.set(key, bucket);
    }
    return table;
  }, [events]);

  const cells = useMemo(() => {
    const { year, month } = cursor;
    const total = daysInMonth(year, month);
    const lead = column(new Date(year, month, 1).getDay());

    const blanks = Array.from({ length: lead }, (_, index) => ({
      key: `blank-${index}`,
      blank: true,
    }));

    const dates = Array.from({ length: total }, (_, index) => {
      const date = new Date(year, month, index + 1);
      const key = dayKey(date);

      return {
        key,
        date,
        number: index + 1,
        marks: {
          class: weeklyClasses.get(date.getDay()) ?? 0,
          ...(eventsByDay.get(key) ?? {}),
        },
      };
    });

    return [...blanks, ...dates];
  }, [cursor, eventsByDay, weeklyClasses]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  );

  const step = (delta) => {
    impact("light");
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-jk-semi text-ink text-[15px]">{monthLabel}</Text>

        <View className="flex-row gap-x-1">
          <Pressable
            onPress={() => step(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={6}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
          >
            <ChevronLeft size={17} color={COLORS.muted} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={6}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
          >
            <ChevronRight size={17} color={COLORS.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row">
        {COLUMNS.map((letter, index) => (
          <View key={index} className="flex-1 items-center">
            <Text className="font-jk text-muted text-[11px]">{letter}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap mt-1">
        {cells.map((cell) => {
          if (cell.blank) {
            return <View key={cell.key} style={{ width: `${100 / 7}%` }} className="h-12" />;
          }

          const isToday = cell.key === todayKey;

          return (
            <Pressable
              key={cell.key}
              onPress={() => {
                impact("light");
                onSelectDate(cell.date);
              }}
              accessibilityRole="button"
              accessibilityLabel={cell.date.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              style={{ width: `${100 / 7}%` }}
              className="h-12 items-center justify-center active:opacity-60"
            >
              <View
                className={`h-7 w-7 items-center justify-center rounded-full ${
                  isToday ? "bg-primary" : ""
                }`}
              >
                <Text
                  className={`text-[13px] ${
                    isToday ? "font-jk-semi text-canvas" : "font-jk text-ink"
                  }`}
                >
                  {cell.number}
                </Text>
              </View>

              <Dots marks={cell.marks} />
            </Pressable>
          );
        })}
      </View>

      {/* Legend. Three dots mean nothing until something says what they are,
          and this is cheaper than making the user tap to find out. */}
      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {[
          { kind: "class", label: "Classes" },
          { kind: "cat", label: "CATs" },
          { kind: "exam", label: "Exams" },
        ].map((item) => (
          <View key={item.kind} className="flex-row items-center gap-x-1.5">
            <View
              style={{ backgroundColor: MARK_COLORS[item.kind] }}
              className="h-1.5 w-1.5 rounded-full"
            />
            <Text className="font-jk text-muted text-[11.5px]">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
