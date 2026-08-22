import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, CalendarOff } from "lucide-react-native";

import Screen from "@/components/Screen";
import IconButton from "@/components/IconButton";
import Fab from "@/components/Fab";
import MonthCalendar from "@/components/MonthCalendar";
import DaySheet from "@/components/DaySheet";
import ClassRow from "@/components/ClassRow";
import EventComposer from "@/components/EventComposer";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { dayKey, greeting, minutesOf } from "@/lib/dates";

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
  const classes = useStudyStore((state) => state.classes);
  const events = useStudyStore((state) => state.events);
  const addEvent = useStudyStore((state) => state.addEvent);
  const toggleEvent = useStudyStore((state) => state.toggleEvent);

  const [composing, setComposing] = useState(false);
  const [openDate, setOpenDate] = useState(null);

  const today = new Date().getDay();

  const todaysClasses = useMemo(
    () =>
      classes
        .filter((entry) => entry.day === today)
        .sort((a, b) => minutesOf(a.start) - minutesOf(b.start)),
    [classes, today]
  );

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
      <Screen fab>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-jk-semi text-ink text-[23px] leading-[29px]">
              {greeting()},
            </Text>
            <Text className="font-jk-bold text-ink text-[30px] leading-[38px]">
              {firstName || "there"} 👋
            </Text>
          </View>

          <IconButton
            Icon={Bell}
            label="Notifications"
            onPress={() => router.push("/notifications")}
            badge={overdue}
          />
        </View>

        {/* --- The month --- */}
        <View>
          {/* No heading. The month name is right there in the calendar, and
              today's date is a dark disc inside it — a title and a date line
              above that said the same thing twice. */}
          <MonthCalendar
            classes={classes}
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

            {todaysClasses.length === 0 ? (
              <EmptyState
                compact
                Icon={CalendarOff}
                title="No classes today"
                message="Add when a unit meets and its sessions appear here on the day."
              />
            ) : (
              todaysClasses.map((entry, index) => (
                <ClassRow
                  key={entry.id}
                  entry={entry}
                  unit={unitById(units, entry.unitId)}
                  today
                  last={index === todaysClasses.length - 1}
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
        classes={classes}
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
