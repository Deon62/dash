import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import { PillButton } from "@/components/Button";
import SessionRow from "@/components/SessionRow";
import SessionComposer from "@/components/SessionComposer";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { DAYS } from "@/theme/units";
import { minutesOf } from "@/lib/dates";

/**
 * The whole week, day by day.
 *
 * Empty days are kept rather than skipped: a week with Wednesday missing looks
 * like a bug, and seeing the gap is half the point of a timetable.
 */
export default function TimetableScreen() {
  const units = useStudyStore((state) => state.units);
  const sessions = useStudyStore((state) => state.sessions);
  const addSession = useStudyStore((state) => state.addSession);
  const removeSession = useStudyStore((state) => state.removeSession);

  const [composing, setComposing] = useState(false);

  const today = new Date().getDay();

  const byDay = useMemo(() => {
    const table = new Map(DAYS.map((day) => [day.index, []]));

    for (const entry of sessions) {
      table.get(entry.day)?.push(entry);
    }
    for (const list of table.values()) {
      list.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    }

    return table;
  }, [sessions]);

  return (
    <>
      <Screen bare>
        <ScreenHeader
          title="Timetable"
          right={
            <IconButton
              Icon={Plus}
              label="Add a session"
              onPress={() => setComposing(true)}
            />
          }
        />

        {sessions.length === 0 ? (
          <EmptyState
            Icon={Plus}
            title="Nothing scheduled"
            message="Add when each unit meets and today's sessions appear on Home."
            action={
              <PillButton label="Add a session" Icon={Plus} onPress={() => setComposing(true)} />
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
                    <Text className="font-jk-med text-primary text-[10px] tracking-[0.8px]">
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
                    <SessionRow
                      key={entry.id}
                      entry={entry}
                      unit={unitById(units, entry.unitId)}
                      today={day.index === today}
                      onRemove={() => removeSession(entry.id)}
                      last={index === entries.length - 1}
                    />
                  ))
                )}
              </View>
            );
          })
        )}
      </Screen>

      <SessionComposer
        visible={composing}
        units={units}
        onClose={() => setComposing(false)}
        onSave={addSession}
      />
    </>
  );
}
