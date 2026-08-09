import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import Screen from "@/components/Screen";
import RideRow from "@/components/RideRow";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function RidesScreen() {
  const router = useRouter();
  const recentRides = useTransitStore((state) => state.recentRides);

  // Grouped by day so a year of history stays scannable.
  const days = useMemo(() => {
    const buckets = new Map();

    for (const ride of recentRides) {
      const key = dayKey(ride.startTime);
      if (!buckets.has(key)) {
        buckets.set(key, { key, date: ride.startTime, rides: [] });
      }
      buckets.get(key).rides.push(ride);
    }

    return [...buckets.values()];
  }, [recentRides]);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            impact("light");
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full border border-brand-hairline bg-white active:opacity-70"
        >
          <ChevronLeft size={19} color="#09090B" strokeWidth={2.2} />
        </Pressable>
        <Text className="font-jk text-brand-muted text-[12px]">
          {recentRides.length} rides
        </Text>
      </View>

      <View className="mt-1">
        <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
          HISTORY
        </Text>
        <Text className="font-jk-black text-brand-black text-[23px] leading-[29px] mt-1.5">
          All rides
        </Text>
      </View>

      {days.length === 0 ? (
        <Text className="font-jk text-brand-muted text-[13px] mt-4">
          No rides logged yet.
        </Text>
      ) : (
        days.map((day) => {
          const minutes = day.rides.reduce((sum, r) => sum + r.durationMin, 0);

          return (
            <View key={day.key} className="mt-3">
              <View className="flex-row items-baseline justify-between mb-3">
                <Text className="font-jk-bold text-brand-black text-[12px]">
                  {dayFormatter.format(day.date)}
                </Text>
                <Text className="font-jk text-brand-muted text-[11px]">
                  {day.rides.length} {day.rides.length === 1 ? "ride" : "rides"} ·{" "}
                  {minutes} min
                </Text>
              </View>

              <View className="gap-y-2.5">
                {day.rides.map((ride) => (
                  <RideRow key={ride.id} ride={ride} />
                ))}
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}
