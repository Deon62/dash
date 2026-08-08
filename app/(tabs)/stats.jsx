import { useMemo } from "react";
import { Text, View } from "react-native";

import Screen from "@/components/Screen";
import DonutChart from "@/components/DonutChart";
import PeriodPicker from "@/components/PeriodPicker";
import TrendChart from "@/components/TrendChart";
import { MODE_KEYS, TRANSIT_MODES } from "@/theme/transitModes";
import { getPeriod } from "@/theme/periods";
import { useTransitStore } from "@/store/useTransitStore";

function formatHours(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Label + value, no container. */
function Figure({ label, value, unit }) {
  return (
    <View className="flex-1 items-center">
      <Text className="font-jk-bold text-brand-muted text-[9px] tracking-[1.5px]">
        {label}
      </Text>
      <View className="flex-row items-baseline mt-1.5">
        <Text className="font-jk-black text-brand-black text-[19px]">{value}</Text>
        {unit ? (
          <Text className="font-jk-semi text-brand-muted text-[11px] ml-1">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const recentRides = useTransitStore((state) => state.recentRides);
  const statsPeriod = useTransitStore((state) => state.statsPeriod);
  const setStatsPeriod = useTransitStore((state) => state.setStatsPeriod);

  const period = getPeriod(statsPeriod);

  const rides = useMemo(() => {
    const cutoff = Date.now() - period.days * 86400000;
    return recentRides.filter((ride) => ride.startTime.getTime() >= cutoff);
  }, [recentRides, period.days]);

  const { totals, byMode, count } = useMemo(() => {
    const t = { minutes: 0, km: 0, fare: 0 };
    const m = Object.fromEntries(
      MODE_KEYS.map((key) => [key, { rides: 0, minutes: 0, km: 0, fare: 0 }])
    );

    for (const ride of rides) {
      t.minutes += ride.durationMin;
      t.km += ride.distanceKm;
      t.fare += ride.fare;

      const bucket = m[ride.vehicleType] ?? m.other;
      bucket.rides += 1;
      bucket.minutes += ride.durationMin;
      bucket.km += ride.distanceKm;
      bucket.fare += ride.fare;
    }

    return { totals: t, byMode: m, count: rides.length };
  }, [rides]);

  // Colour follows the mode, so both charts and the list agree by construction.
  const series = MODE_KEYS.map((key) => ({
    key,
    label: TRANSIT_MODES[key].label,
    color: TRANSIT_MODES[key].color,
    rides: byMode[key].rides,
  }));

  const activeModes = series.filter((s) => s.rides > 0).length;

  // Bucket the window into a handful of equal slices — enough shape to read a
  // trend, few enough that the x-axis stays legible on a phone.
  const trend = useMemo(() => {
    const buckets = period.days <= 7 ? 7 : 6;
    const span = (period.days * 86400000) / buckets;
    const start = Date.now() - period.days * 86400000;

    const totals = new Array(buckets).fill(0);
    for (const ride of rides) {
      const index = Math.min(
        buckets - 1,
        Math.floor((ride.startTime.getTime() - start) / span)
      );
      if (index >= 0) totals[index] += ride.durationMin;
    }

    const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

    return {
      bucketLabel: period.days <= 7 ? "day" : `${Math.round(period.days / buckets)} days`,
      points: totals.map((minutes, i) => ({
        label: fmt.format(new Date(start + i * span)),
        value: Number((minutes / 60).toFixed(1)),
      })),
    };
  }, [rides, period.days]);

  return (
    <Screen>
      {/* One filter, above everything it scopes. */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
            YOUR COMMUTE
          </Text>
          <Text className="font-jk-black text-brand-black text-[23px] leading-[29px] mt-1.5">
            {period.heading}
          </Text>
        </View>
        <PeriodPicker value={statsPeriod} onChange={setStatsPeriod} />
      </View>

      <View className="flex-row mt-1">
        <Figure label="TIME" value={formatHours(totals.minutes)} />
        <Figure label="DISTANCE" value={totals.km.toFixed(1)} unit="km" />
        <Figure label="SPEND" value={totals.fare} unit="KES" />
      </View>

      {/* Part-to-whole: which modes make up the month */}
      <View className="items-center mt-6">
        <DonutChart
          segments={series.map((s) => ({
            key: s.key,
            value: s.rides,
            color: s.color,
          }))}
        >
          {/* The one hero figure on this view. */}
          <Text className="font-jk-black text-brand-black text-[48px] leading-[54px]">
            {count}
          </Text>
          <Text className="font-jk text-brand-muted text-[12px] mt-0.5">
            {activeModes === 1 ? "ride in 1 mode" : `rides in ${activeModes} modes`}
          </Text>
        </DonutChart>
      </View>

      {/* Legend + table view in one: every value is readable here. */}
      <View className="gap-y-3.5 mt-7">
        {series.map((s) => {
          const pct = count ? Math.round((s.rides / count) * 100) : 0;

          return (
            <View key={s.key} className="flex-row items-center">
              <View
                style={{ backgroundColor: s.color }}
                className="h-2.5 w-2.5 rounded-full"
              />
              <Text className="font-jk-semi text-brand-black text-[13px] ml-3 w-[86px]">
                {s.label}
              </Text>

              {/* Share track — the fill is the mark, the text stays in ink. */}
              <View className="flex-1 h-1.5 rounded-full bg-brand-hairline overflow-hidden mr-3">
                <View
                  style={{ width: `${pct}%`, backgroundColor: s.color }}
                  className="h-full rounded-full"
                />
              </View>

              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className="font-jk-semi text-brand-muted text-[12px] w-8 text-right"
              >
                {pct}%
              </Text>
              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className="font-jk-bold text-brand-black text-[12px] w-12 text-right"
              >
                {s.rides} {s.rides === 1 ? "ride" : "rides"}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Change over time — a different question from the ring's composition */}
      <View className="mt-9">
        <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
          TIME IN TRANSIT
        </Text>
        <Text className="font-jk-semi text-brand-slate text-[12px] mt-1">
          Hours per {trend.bucketLabel}
        </Text>
        <View className="mt-5">
          <TrendChart points={trend.points} valueLabel="h" />
        </View>
      </View>
    </Screen>
  );
}
