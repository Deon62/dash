import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import ClassRow from "@/components/ClassRow";
import ClassComposer from "@/components/ClassComposer";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { DAYS } from "@/theme/units";
import { minutesOf } from "@/lib/dates";
import { impact } from "@/lib/haptics";

/**
 * The whole week, day by day.
 *
 * Empty days are kept rather than skipped: a week with Wednesday missing looks
 * like a bug, and seeing the gap is half the point of a timetable.
 */
export default function TimetableScreen() {
  const units = useStudyStore((state) => state.units);
  const classes = useStudyStore((state) => state.classes);
  const addClass = useStudyStore((state) => state.addClass);
  const removeClass = useStudyStore((state) => state.removeClass);

  const [composing, setComposing] = useState(false);

  const today = new Date().getDay();

  const byDay = useMemo(() => {
    const table = new Map(DAYS.map((day) => [day.index, []]));

    for (const entry of classes) {
      table.get(entry.day)?.push(entry);
    }
    for (const list of table.values()) {
      list.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    }

    return table;
  }, [classes]);

  return (
    <>
      <Screen bare>
        <ScreenHeader
          title="Class timetable"
          description={`${classes.length} ${classes.length === 1 ? "session" : "sessions"} a week.`}
          right={
            <IconButton
              Icon={Plus}
              label="Add a class"
              onPress={() => setComposing(true)}
            />
          }
        />

        {classes.length === 0 ? (
          <EmptyState
            Icon={Plus}
            title="Nothing scheduled"
            message="Add when each unit meets and today's sessions appear on Home."
            action={
              <Pressable
                onPress={() => {
                  impact("medium");
                  setComposing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Add a class"
                className="flex-row items-center gap-x-2 rounded-full bg-obsidian px-5 py-3 active:opacity-85"
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={1.8} />
                <Text className="font-jk-med text-canvas text-[14px]">Add a class</Text>
              </Pressable>
            }
          />
        ) : (
          DAYS.map((day) => {
            const entries = byDay.get(day.index) ?? [];

            return (
              <View key={day.index}>
                <View className="flex-row items-center gap-x-2">
                  <Text
                    className={`text-[13px] tracking-[0.6px] ${
                      day.index === today ? "font-jk-semi text-ink" : "font-jk text-muted"
                    }`}
                  >
                    {day.long.toUpperCase()}
                  </Text>
                  {day.index === today ? (
                    <Text className="font-jk-med text-indigo text-[10px] tracking-[0.8px]">
                      TODAY
                    </Text>
                  ) : null}
                </View>

                {entries.length === 0 ? (
                  <Text className="font-jk text-muted text-[13px] py-3.5">
                    Free
                  </Text>
                ) : (
                  entries.map((entry, index) => (
                    <ClassRow
                      key={entry.id}
                      entry={entry}
                      unit={unitById(units, entry.unitId)}
                      today={day.index === today}
                      onRemove={() => removeClass(entry.id)}
                      last={index === entries.length - 1}
                    />
                  ))
                )}
              </View>
            );
          })
        )}
      </Screen>

      <ClassComposer
        visible={composing}
        units={units}
        onClose={() => setComposing(false)}
        onSave={addClass}
      />
    </>
  );
}
