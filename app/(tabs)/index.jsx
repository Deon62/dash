import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, CalendarDays, Clock } from "lucide-react-native";

import Screen from "@/components/Screen";
import SectionHeading from "@/components/SectionHeading";
import IconButton from "@/components/IconButton";
import Fab from "@/components/Fab";
import MonthCalendar from "@/components/MonthCalendar";
import DaySheet from "@/components/DaySheet";
import ClassRow from "@/components/ClassRow";
import EventRow from "@/components/EventRow";
import EventComposer from "@/components/EventComposer";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { greeting, minutesOf } from "@/lib/dates";

/** How many upcoming items the dashboard shows before it stops being a summary. */
const UPCOMING_LIMIT = 5;

/**
 * The dashboard: today, and what is coming.
 *
 * Two sections and nothing else. Everything that invites browsing — units,
 * notes, past chats — lives in the tab that owns it, so this one can answer
 * "what is happening" without becoming a second copy of the app.
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

  // Undated items sort last: something with no date cannot be urgent, and
  // putting it first would bury what is.
  const upcoming = useMemo(
    () =>
      events
        .filter((event) => !event.done)
        .sort((a, b) => (a.at ?? "9999").localeCompare(b.at ?? "9999"))
        .slice(0, UPCOMING_LIMIT),
    [events]
  );

  const firstName = profile.name.trim().split(/\s+/)[0];
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
            badge={upcoming.some((event) => (event.at ?? "") <= new Date().toISOString())}
          />
        </View>

        {/* --- Timetable --- */}
        <View>
          <SectionHeading
            title="Timetable"
            caption={dateLabel}
            action="Full week"
            onAction={() => router.push("/timetable")}
          />

          <View className="mt-4">
            <MonthCalendar
              classes={classes}
              events={events}
              onSelectDate={setOpenDate}
            />
          </View>

          {/* The calendar is the shape of the month; this is the detail for the
              day the student is actually in. Any other day opens in a sheet. */}
          <View className="mt-5 border-t border-line pt-3">
            <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
              TODAY
            </Text>

            {todaysClasses.length === 0 ? (
              <EmptyState
                compact
                Icon={Clock}
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

        {/* --- Upcoming --- */}
        <View>
          <SectionHeading title="Upcoming" />

          <View className="mt-2">
            {upcoming.length === 0 ? (
              <EmptyState
                compact
                Icon={CalendarDays}
                title="Nothing coming up"
                message="Assignments, CATs and exams you add show up here, soonest first."
              />
            ) : (
              upcoming.map((event, index) => (
                <EventRow
                  key={event.id}
                  event={event}
                  unit={unitById(units, event.unitId)}
                  onToggle={() => toggleEvent(event.id)}
                  last={index === upcoming.length - 1}
                />
              ))
            )}
          </View>
        </View>
      </Screen>

      {/* Adding an event is the only thing you do *to* this screen, so it gets
          the same thumb-reachable disc Knowledge uses rather than a small
          control tucked beside a heading. */}
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
