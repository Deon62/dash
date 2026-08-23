import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { COLORS, MARK_COLORS } from "@/theme/colors";
import { dayKey } from "@/lib/dates";
import { impact } from "@/lib/haptics";

/** Big enough to read at arm's length; three still fit under a date. */
const DOT = 6;

/** Monday-first column headings, matching how a timetable is printed. */
const COLUMNS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Draw order for the marks under a date.
 *
 * Most urgent first: only three dots fit, so the ones that get cut should be
 * the ones that matter least on the day.
 */
const DOT_ORDER = ["exam", "cat", "assignment", "project", "class", "other"];

/** Grid position of a weekday, Monday at 0 and Sunday at 6. */
function column(day) {
  return (day + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function Dot({ kind }) {
  return (
    <View
      style={{
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        backgroundColor: MARK_COLORS[kind],
      }}
    />
  );
}

/**
 * A dot per kind of thing happening, capped at three, for days still to come.
 *
 * Built from whatever keys the day actually carries rather than from a fixed
 * list: an event whose `kind` is missing or something the app has not heard of
 * used to match nothing and draw no dot at all, so the day looked empty when it
 * was not. Anything unrecognised falls back to the catch-all mark.
 */
function Dots({ marks, past }) {
  // A dot is a heads-up, and there is nothing to be warned about on a day that
  // has already happened. The row still takes its height so the weeks below do
  // not ride up.
  if (past) return <View style={{ height: DOT, marginTop: 4 }} />;

  const kinds = Object.keys(marks)
    .filter((kind) => marks[kind] > 0)
    .map((kind) => (MARK_COLORS[kind] ? kind : "other"))
    .sort((a, b) => DOT_ORDER.indexOf(a) - DOT_ORDER.indexOf(b));

  // Reserve the row even when empty, so dates with and without marks sit at
  // the same height and the grid does not jump.
  if (kinds.length === 0) return <View style={{ height: DOT, marginTop: 4 }} />;

  return (
    <View style={{ height: DOT, marginTop: 4, flexDirection: "row", columnGap: 4 }}>
      {[...new Set(kinds)].slice(0, 3).map((kind) => (
        <Dot key={kind} kind={kind} />
      ))}
    </View>
  );
}

/**
 * Month grid with a dot for everything on each day.
 *
 * The whole point is the shape of the month at a glance — where the exams
 * cluster, which week is empty.
 *
 * There is no key under the grid. Six labelled swatches took as much room as
 * the calendar itself to explain something one tap answers properly: the day
 * sheet names every item on the day, which is what a student wanted the moment
 * a dot caught their eye.
 */
export default function MonthCalendar({
  classes,
  events,
  onSelectDate,
  action,
  onAction,
}) {
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

        <View className="flex-row items-center gap-x-1">
          {action ? (
            <Pressable
              onPress={() => {
                impact("light");
                onAction?.();
              }}
              accessibilityRole="button"
              accessibilityLabel={action}
              hitSlop={6}
              className="px-2 active:opacity-60"
            >
              <Text className="font-jk-med text-primary text-[13px]">{action}</Text>
            </Pressable>
          ) : null}

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
            return <View key={cell.key} style={{ width: `${100 / 7}%`, height: 48 }} />;
          }

          const isToday = cell.key === todayKey;
          // Compared as keys, not timestamps: `dayKey` is sortable and already
          // anchored to the local day, so there is no hour-of-day edge to get
          // wrong at either end of the month.
          const isPast = cell.key < todayKey;

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
              style={{
                width: `${100 / 7}%`,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
              className="active:opacity-60"
            >
              {/* Today is a dark disc, every month, whether or not anything is
                  on — the one fixed landmark in the grid. Its number is set
                  white inline rather than by a class, because a colour that
                  fails to apply here leaves black text on a black disc and the
                  date disappears entirely. */}
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isToday ? COLORS.ink : "transparent",
                }}
              >
                {/* Faint rather than struck through: a line through every
                    date up to today draws more attention to the half of the
                    month that no longer matters than to the half that does. */}
                <Text
                  style={{
                    color: isToday
                      ? COLORS.canvas
                      : isPast
                        ? COLORS.faint
                        : COLORS.ink,
                  }}
                  className={`text-[13px] ${isToday ? "font-jk-semi" : "font-jk"}`}
                >
                  {cell.number}
                </Text>
              </View>

              <Dots marks={cell.marks} past={isPast} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
