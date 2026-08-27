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
import { systemAlerts } from "@/lib/systemAlerts";
import { COLORS } from "@/theme/colors";
import { daysUntil, dueLabel, formatTime, minutesOf, nowMinutes } from "@/lib/dates";

/**
 * What the app would have told you about.
 *
 * Two sources, one list. Deadlines and sessions come from the student's own
 * coursework; the rest is the app reporting on itself — a sync that has not
 * got through, a file that has not uploaded, a payment still clearing.
 *
 * Everything is derived rather than stored. A list built from live state can
 * never show a reminder for something already handed in, and an alert about a
 * failure cannot outlive the failure: the sync that succeeds removes its own
 * warning without anything having to remember to.
 */
export default function NotificationsScreen() {
  const router = useRouter();

  const units = useStudyStore((state) => state.units);
  const sessions = useStudyStore((state) => state.sessions);
  const events = useStudyStore((state) => state.events);

  // The slices the alerts are built from, each selected on its own.
  //
  // Not `useStudyStore(systemAlerts)`, tempting as that is: a selector that
  // builds an array returns a new one on every call, and React compares
  // snapshots by identity — so it would decide the store had changed every
  // render and spin. Selecting stable references and deriving in a memo below
  // is the version that settles.
  const materials = useStudyStore((state) => state.materials);
  const chats = useStudyStore((state) => state.chats);
  const tombstones = useStudyStore((state) => state.tombstones);
  const subscription = useStudyStore((state) => state.subscription);
  const syncError = useStudyStore((state) => state.syncError);

  const alerts = useMemo(
    () =>
      systemAlerts({
        units,
        sessions,
        materials,
        events,
        chats,
        tombstones,
        subscription,
        syncError,
      }),
    [units, sessions, materials, events, chats, tombstones, subscription, syncError],
  );

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

    for (const entry of sessions) {
      if (entry.day !== today) continue;
      if (minutesOf(entry.end) <= now) continue;

      const unit = unitById(units, entry.unitId);
      list.push({
        id: `session-${entry.id}`,
        Icon: BellRing,
        title: `${unit?.code ?? "Session"} at ${formatTime(entry.start)}`,
        body: [unit?.title, entry.room].filter(Boolean).join(" · "),
        urgent: false,
        sort: -0.5,
      });
    }

    return [...alerts, ...list].sort((a, b) => a.sort - b.sort);
  }, [sessions, events, units, alerts]);

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
          message="No sessions left today, nothing due in the next three days, and everything is saved to your account."
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
