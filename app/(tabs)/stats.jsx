import { useMemo } from "react";
import { Text, View } from "react-native";
import { Route, Timer, Wallet } from "lucide-react-native";

import Screen from "@/components/Screen";
import ModeBars from "@/components/ModeBars";
import EmptyState from "@/components/EmptyState";
import StatsArt from "../../assets/stat.svg";
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

/**
 * Headline scalar with a tinted glyph.
 *
 * Not a donut: a ring encodes part-to-whole, and these three measure unrelated
 * things with no total to divide up — a one-value ring would be decoration
 * pretending to be a chart. The number is the chart; the glyph just labels it.
 * Colour here is decorative, and each figure carries its own text label.
 */
function Figure({ label, value, unit, Icon, tint }) {
  return (
    <View className="flex-1 items-center">
      {/* Neutral grey well, circular — the icon carries the only colour. */}
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-black/[0.05]">
        <Icon size={19} color={tint} strokeWidth={2.2} />
      </View>

      <View className="flex-row items-baseline mt-2.5">
        <Text className="font-jk-black text-brand-black text-[19px]">{value}</Text>
        {unit ? (
          <Text className="font-jk-semi text-brand-muted text-[11px] ml-1">
            {unit}
          </Text>
        ) : null}
      </View>

      <Text className="font-jk-bold text-brand-muted text-[9px] tracking-[1.5px] mt-1">
        {label}
      </Text>
    </View>
  );
}

export default function StatsScreen() {
  const recentRides = useTransitStore((state) => state.recentRides);
  const statsPeriod = useTransitStore((state) => state.statsPeriod);
  const setStatsPeriod = useTransitStore((state) => state.setStatsPeriod);
  // Fares follow the currency chosen in settings rather than a hardcoded KES.
  const currency = useTransitStore((state) => state.settings.currency);

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

  // Every mode that actually saw a ride, biggest first. Bars cope with all
  // nine, so nothing is folded away and no label collides with the real
  // "Other" mode.
  const series = useMemo(
    () =>
      MODE_KEYS.map((key) => ({
        key,
        label: TRANSIT_MODES[key].label,
        color: TRANSIT_MODES[key].color,
        value: byMode[key].rides,
      }))
        .filter((s) => s.value > 0)
        .sort((a, b) => b.value - a.value),
    [byMode]
  );

  const activeModes = series.length;

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

  // With nothing logged there is no period to filter and no figures to show —
  // the whole page reduces to one centred message.
  if (count === 0) {
    return (
      <Screen contentStyle={{ flexGrow: 1, rowGap: 0 }}>
        <EmptyState
          Art={StatsArt}
          title="Nothing logged yet"
          message="Start a trip on the Trips tab and your time, distance and spend will show up here."
        />
      </Screen>
    );
  }

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

      <>
      <View className="flex-row mt-2">
        <Figure
          label="TIME"
          value={formatHours(totals.minutes)}
          Icon={Timer}
          tint="#2a78d6"
        />
        <Figure
          label="DISTANCE"
          value={totals.km.toFixed(1)}
          unit="km"
          Icon={Route}
          tint="#1baf7a"
        />
        <Figure
          label="SPEND"
          value={totals.fare}
          unit={currency}
          Icon={Wallet}
          tint="#eb6834"
        />
      </View>

      {/* The one hero figure on this view. */}
      <View className="mt-7">
        <View className="flex-row items-baseline">
          <Text className="font-jk-black text-brand-black text-[48px] leading-[54px]">
            {count}
          </Text>
          <Text className="font-jk text-brand-muted text-[13px] ml-2">
            {activeModes === 1 ? "rides · 1 mode" : `rides · ${activeModes} modes`}
          </Text>
        </View>
      </View>

      <View className="mt-5">
        <ModeBars data={series} total={count} />
      </View>

      {/* Change over time — a different question from the mode breakdown */}
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
      </>
    </Screen>
  );
}
