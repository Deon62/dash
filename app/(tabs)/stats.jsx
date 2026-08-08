import { useMemo } from "react";
import { Text, View } from "react-native";

import Screen from "@/components/Screen";
import SectionHeading from "@/components/SectionHeading";
import StatCard from "@/components/StatCard";
import { MODE_KEYS, TRANSIT_MODES } from "@/theme/transitModes";
import { useTransitStore } from "@/store/useTransitStore";

// Greyscale ramp for the split bar — mode identity comes from the icon and
// label beneath it, so the chart itself stays monochrome.
const SPLIT_TONES = ["#09090B", "#52525B", "#A1A1AA", "#D4D4D8"];

export default function StatsScreen() {
  const recentRides = useTransitStore((state) => state.recentRides);

  const summary = useMemo(() => {
    const totals = { minutes: 0, km: 0, fare: 0 };
    const byMode = Object.fromEntries(MODE_KEYS.map((key) => [key, 0]));

    for (const ride of recentRides) {
      totals.minutes += ride.durationMin;
      totals.km += ride.distanceKm;
      totals.fare += ride.fare;
      if (byMode[ride.vehicleType] !== undefined) byMode[ride.vehicleType] += 1;
    }

    return { totals, byMode, count: recentRides.length };
  }, [recentRides]);

  return (
    <Screen>
      <SectionHeading eyebrow="This month" title="Your commute, measured" />

      <View className="flex-row gap-x-3">
        <StatCard
          label="Time moving"
          value={Math.round(summary.totals.minutes / 60)}
          unit="hrs"
          caption={`${summary.totals.minutes} min across ${summary.count} rides`}
        />
        <StatCard
          label="Distance"
          value={summary.totals.km.toFixed(1)}
          unit="km"
          caption="Enough to cross the city 4×"
        />
      </View>

      <View className="flex-row gap-x-3">
        <StatCard
          label="Spend"
          value={summary.totals.fare}
          unit="KES"
          caption="Fares logged so far"
        />
        <StatCard
          label="Avg leg"
          value={
            summary.count
              ? Math.round(summary.totals.minutes / summary.count)
              : 0
          }
          unit="min"
          caption="Door to door"
        />
      </View>

      {/* Mode split */}
      <View className="rounded-3xl border border-brand-border bg-brand-white p-5">
        <Text className="font-jk-bold text-brand-slate text-[10px] tracking-[2px]">
          MODE SPLIT
        </Text>

        <View className="flex-row h-3 rounded-full overflow-hidden mt-4 gap-x-0.5">
          {MODE_KEYS.map((key, i) => {
            const share = summary.count ? summary.byMode[key] / summary.count : 0;
            if (share === 0) return null;
            return (
              <View
                key={key}
                style={{ flex: share, backgroundColor: SPLIT_TONES[i] }}
              />
            );
          })}
        </View>

        <View className="gap-y-3 mt-5">
          {MODE_KEYS.map((key) => {
            const mode = TRANSIT_MODES[key];
            const rides = summary.byMode[key];
            const pct = summary.count
              ? Math.round((rides / summary.count) * 100)
              : 0;

            return (
              <View key={key} className="flex-row items-center">
                <View className="h-7 w-7 items-center justify-center rounded-lg bg-brand-black/[0.04]">
                  <mode.Icon size={14} color="#09090B" strokeWidth={2.1} />
                </View>
                <Text className="font-jk-semi text-brand-black text-[13px] flex-1 ml-2.5">
                  {mode.label}
                </Text>
                <Text className="font-jk text-brand-slate text-[12px] mr-3">
                  {rides} {rides === 1 ? "ride" : "rides"}
                </Text>
                <Text className="font-jk-black text-brand-black text-[13px] w-10 text-right">
                  {pct}%
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="rounded-3xl border border-brand-border bg-brand-white p-5">
        <Text className="font-jk-bold text-brand-slate text-[10px] tracking-[2px]">
          COMING SOON
        </Text>
        <Text className="font-jk-black text-brand-black text-[20px] leading-[26px] mt-2">
          Hour-by-hour heatmap
        </Text>
        <Text className="font-jk text-brand-slate text-[13px] leading-[19px] mt-1.5">
          Once a week of motion data is captured, this panel will show when you
          actually leave the house versus when you think you do.
        </Text>
      </View>
    </Screen>
  );
}
