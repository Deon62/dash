import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, CalendarOff } from "lucide-react-native";

import Screen from "@/components/Screen";
import IconButton from "@/components/IconButton";
import StreakBadge from "@/components/StreakBadge";
import Fab from "@/components/Fab";
import MonthCalendar from "@/components/MonthCalendar";
import DaySheet from "@/components/DaySheet";
import SessionRow from "@/components/SessionRow";
import EventComposer from "@/components/EventComposer";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { liveStreak } from "@/lib/streak";
import { hasSystemAlerts } from "@/lib/systemAlerts";
import { dayKey, greeting, minutesOf } from "@/lib/dates";
import { pullSync } from "@/lib/sync";

/**
 * The dashboard: the month, and the day you are in.
 *
 * There is no list of what is coming. The calendar already carries it — every
 * deadline is a dot on the day it falls, and tapping that day opens the detail.
 * A list underneath repeated the same information in a different order, which
 * meant two places to look and two places to keep in step.
 *
 * Everything that invites browsing — units, notes, past chats — lives in the
 * tab that owns it, so this one can answer "what is happening" without becoming
 * a second copy of the app.
 */
export default function HomeScreen() {
  const router = useRouter();

  const profile = useStudyStore((state) => state.profile);
  const units = useStudyStore((state) => state.units);
  const sessions = useStudyStore((state) => state.sessions);
  const events = useStudyStore((state) => state.events);
  const addEvent = useStudyStore((state) => state.addEvent);
  const toggleEvent = useStudyStore((state) => state.toggleEvent);
  const study = useStudyStore((state) => state.study);

  const [composing, setComposing] = useState(false);
  const [openDate, setOpenDate] = useState(null);

  const today = new Date().getDay();

  const todaysSessions = useMemo(
    () =>
      sessions
        .filter((entry) => entry.day === today)
        .sort((a, b) => minutesOf(a.start) - minutesOf(b.start)),
    [sessions, today]
  );

  // Anything the app itself needs to say: a sync that has not got through, a
  // file that has not uploaded, a payment still clearing. See
  // `src/lib/systemAlerts.js` — it is the same list the bell opens onto.
  const systemPending = useStudyStore(hasSystemAlerts);

  // The bell marks anything already due — the one thing a dot on a past date
  // cannot say on its own, since the calendar shows the month, not the clock.
  const overdue = useMemo(() => {
    const now = dayKey();
    return events.some(
      (event) => !event.done && event.at && dayKey(event.at) <= now
    );
  }, [events]);

  const firstName = profile.name.trim().split(/\s+/)[0];

  return (
    <>
      <Screen fab onRefresh={pullSync}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-jk-semi text-ink text-[23px] leading-[29px]">
              {greeting()},
            </Text>
            <Text className="font-jk-bold text-ink text-[30px] leading-[38px]">
              {firstName || "there"} 👋
            </Text>
          </View>

          {/* Streak first, then the bell: one is a reward and the other is a
              demand, and the reward should not be the thing you reach past. */}
          <View className="flex-row items-center gap-x-2">
            <StreakBadge
              days={liveStreak(study)}
              onPress={() => router.push("/streak")}
            />
            <IconButton
              Icon={Bell}
              label="Notifications"
              onPress={() => router.push("/notifications")}
              // Anything the app itself needs to say counts as well, or a
              // stalled sync would sit in a screen nothing points at.
              badge={overdue || systemPending}
            />
          </View>
        </View>

        {/* --- The month --- */}
        <View>
          {/* No heading. The month name is right there in the calendar, and
              today's date is a dark disc inside it — a title and a date line
              above that said the same thing twice. */}
          <MonthCalendar
            sessions={sessions}
            events={events}
            onSelectDate={setOpenDate}
            action="Full week"
            onAction={() => router.push("/timetable")}
          />

          {/* The calendar is the shape of the month; this is the detail for the
              day the student is actually in. Any other day opens in a sheet. */}
          <View className="mt-5 border-t border-line pt-3">
            <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
              TODAY
            </Text>

            {todaysSessions.length === 0 ? (
              <EmptyState
                compact
                Icon={CalendarOff}
                title="No sessions today"
                message="Add when a unit meets and its sessions appear here on the day."
              />
            ) : (
              todaysSessions.map((entry, index) => (
                <SessionRow
                  key={entry.id}
                  entry={entry}
                  unit={unitById(units, entry.unitId)}
                  today
                  last={index === todaysSessions.length - 1}
                />
              ))
            )}
          </View>
        </View>

      </Screen>

      {/* Adding an event is still the one thing you do *to* this screen, even
          though nothing lists events any more — what you add turns into a dot
          on its day. */}
      <Fab label="Add an event" onPress={() => setComposing(true)} />

      <DaySheet
        date={openDate}
        units={units}
        sessions={sessions}
        events={events}
        onToggleEvent={toggleEvent}
        onClose={() => setOpenDate(null)}
      />

      <EventComposer
        visible={composing}
        units={units}
        onClose={() => setComposing(false)}
        onSave={addEvent}
      />
    </>
  );
}
