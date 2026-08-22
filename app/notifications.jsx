import { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BellRing, CalendarClock, Settings } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import Disc from "@/components/Disc";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { COLORS } from "@/theme/colors";
import { daysUntil, dueLabel, formatTime, minutesOf, nowMinutes } from "@/lib/dates";

/**
 * What the app would have told you about.
 *
 * Derived from the timetable and the deadline list rather than stored: with no
 * push notifications wired up there is no inbox to keep, and a list built from
 * live data can never show a reminder for something already handed in.
 */
export default function NotificationsScreen() {
  const router = useRouter();

  const units = useStudyStore((state) => state.units);
  const classes = useStudyStore((state) => state.classes);
  const events = useStudyStore((state) => state.events);

  const items = useMemo(() => {
    const today = new Date().getDay();
    const now = nowMinutes();
    const list = [];

    for (const event of events) {
      if (event.done) continue;
      const days = daysUntil(event.at);
      if (days === null || days > 3) continue;

      list.push({
        id: `event-${event.id}`,
        Icon: CalendarClock,
        title: event.title,
        body: [unitById(units, event.unitId)?.code, dueLabel(event.at)]
          .filter(Boolean)
          .join(" · "),
        urgent: days <= 0,
        sort: days,
      });
    }

    for (const entry of classes) {
      if (entry.day !== today) continue;
      if (minutesOf(entry.end) <= now) continue;

      const unit = unitById(units, entry.unitId);
      list.push({
        id: `class-${entry.id}`,
        Icon: BellRing,
        title: `${unit?.code ?? "Class"} at ${formatTime(entry.start)}`,
        body: [unit?.title, entry.room].filter(Boolean).join(" · "),
        urgent: false,
        sort: -0.5,
      });
    }

    return list.sort((a, b) => a.sort - b.sort);
  }, [classes, events, units]);

  return (
    <Screen bare>
      <ScreenHeader
        title="Notifications"
        right={
          <IconButton
            Icon={Settings}
            label="Notification preferences"
            onPress={() => router.push("/settings/notifications")}
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          Icon={BellRing}
          title="Nothing needs you"
          message="No classes left today and nothing due in the next three days."
        />
      ) : (
        <View>
          {items.map((item, index) => (
            <View
              key={item.id}
              className={`flex-row items-start py-4 ${
                index === items.length - 1 ? "" : "border-b border-line"
              }`}
            >
              <Disc size={36}>
                <item.Icon
                  size={16}
                  color={item.urgent ? COLORS.danger : COLORS.ink}
                  strokeWidth={1.8}
                />
              </Disc>

              <View className="flex-1 ml-3.5">
                <Text className="font-jk-med text-ink text-[14.5px] leading-[20px]">
                  {item.title}
                </Text>
                <Text
                  className={`text-[12.5px] mt-0.5 ${
                    item.urgent ? "font-jk-med text-danger" : "font-jk text-muted"
                  }`}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
