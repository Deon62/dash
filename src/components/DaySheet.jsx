import { useMemo } from "react";
import { Text, View } from "react-native";

import Sheet from "@/components/Sheet";
import ClassRow from "@/components/ClassRow";
import EventRow from "@/components/EventRow";
import { unitById } from "@/store/useStudyStore";
import { dayKey, minutesOf } from "@/lib/dates";

/**
 * What is happening on one day.
 *
 * Opened from a calendar cell, where there is only room for dots. The headline
 * counts what the dots meant, then the rows say when and what.
 */
export default function DaySheet({
  date,
  onClose,
  units,
  classes,
  events,
  onToggleEvent,
}) {
  const key = date ? dayKey(date) : null;

  const dayClasses = useMemo(() => {
    if (!date) return [];
    return classes
      .filter((entry) => entry.day === date.getDay())
      .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  }, [classes, date]);

  const dayEvents = useMemo(() => {
    if (!key) return [];
    return events
      .filter((event) => event.at && dayKey(event.at) === key)
      .sort((a, b) => Number(a.done) - Number(b.done));
  }, [events, key]);

  const title = date
    ? date.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  const counts = [
    dayClasses.length
      ? `${dayClasses.length} ${dayClasses.length === 1 ? "class" : "classes"}`
      : null,
    dayEvents.length
      ? `${dayEvents.length} ${dayEvents.length === 1 ? "deadline" : "deadlines"}`
      : null,
  ].filter(Boolean);

  const isToday = key === dayKey();

  return (
    <Sheet
      visible={Boolean(date)}
      onClose={onClose}
      title={title}
      subtitle={counts.length ? counts.join(" · ") : "Nothing scheduled"}
    >
      {dayClasses.length > 0 ? (
        <View>
          <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
            CLASSES
          </Text>
          {dayClasses.map((entry, index) => (
            <ClassRow
              key={entry.id}
              entry={entry}
              unit={unitById(units, entry.unitId)}
              // The "now" highlight is only true information on today; on any
              // other date it would mark a class that is not running.
              today={isToday}
              last={index === dayClasses.length - 1}
            />
          ))}
        </View>
      ) : null}

      {dayEvents.length > 0 ? (
        <View className={dayClasses.length > 0 ? "mt-5" : ""}>
          <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
            DUE
          </Text>
          {dayEvents.map((event, index) => (
            <EventRow
              key={event.id}
              event={event}
              unit={unitById(units, event.unitId)}
              onToggle={() => onToggleEvent(event.id)}
              last={index === dayEvents.length - 1}
            />
          ))}
        </View>
      ) : null}

      {dayClasses.length === 0 && dayEvents.length === 0 ? (
        <Text className="font-jk text-muted text-[13.5px] leading-[20px] py-2">
          A free day. Nothing on the timetable and nothing due.
        </Text>
      ) : null}
    </Sheet>
  );
}
