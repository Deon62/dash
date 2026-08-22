import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { COLORS } from "@/theme/colors";
import { dayKey } from "@/lib/dates";
import { impact } from "@/lib/haptics";

const COLUMNS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday at 0, Sunday at 6. */
function column(day) {
  return (day + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** A due date is set to the end of its day — that is what "due Friday" means. */
export function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 0, 0);
  return copy;
}

/**
 * Pick a day off a month.
 *
 * Dates before today are drawn but not selectable: a deadline in the past is
 * almost always a mis-tap, and greying them out says so without hiding the
 * shape of the month. Paging is unrestricted in the other direction.
 */
export default function DatePicker({ value, onChange }) {
  const today = new Date();
  const todayKey = dayKey(today);

  const selected = value ? new Date(value) : null;
  const selectedKey = selected ? dayKey(selected) : null;

  const [cursor, setCursor] = useState(() => {
    const start = selected ?? today;
    return { year: start.getFullYear(), month: start.getMonth() };
  });

  const cells = useMemo(() => {
    const { year, month } = cursor;
    const total = daysInMonth(year, month);
    const lead = column(new Date(year, month, 1).getDay());

    return [
      ...Array.from({ length: lead }, (_, index) => ({
        key: `blank-${index}`,
        blank: true,
      })),
      ...Array.from({ length: total }, (_, index) => {
        const date = new Date(year, month, index + 1);
        return { key: dayKey(date), date, number: index + 1 };
      }),
    ];
  }, [cursor]);

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
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-jk-semi text-ink text-[15px]">{monthLabel}</Text>

        <View className="flex-row items-center gap-x-1">
          <Pressable
            onPress={() => step(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={6}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}
            className="active:bg-surface"
          >
            <ChevronLeft size={17} color={COLORS.muted} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={6}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}
            className="active:bg-surface"
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
            return <View key={cell.key} style={{ width: `${100 / 7}%`, height: 42 }} />;
          }

          const isSelected = cell.key === selectedKey;
          const isToday = cell.key === todayKey;
          const past = cell.key < todayKey;

          return (
            <Pressable
              key={cell.key}
              disabled={past}
              onPress={() => {
                impact("light");
                onChange(endOfDay(cell.date).toISOString());
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: past }}
              accessibilityLabel={cell.date.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              style={{
                width: `${100 / 7}%`,
                height: 42,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? COLORS.primary : "transparent",
                  // Today is ringed rather than filled, so it never competes
                  // with the day you actually picked.
                  borderWidth: !isSelected && isToday ? 1 : 0,
                  borderColor: COLORS.line,
                  opacity: past ? 0.3 : 1,
                }}
              >
                <Text
                  style={{ color: isSelected ? COLORS.canvas : COLORS.ink }}
                  className={`text-[13.5px] ${
                    isSelected || isToday ? "font-jk-semi" : "font-jk"
                  }`}
                >
                  {cell.number}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
