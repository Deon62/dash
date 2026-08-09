import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Download, Share2 } from "lucide-react-native";

import Screen from "@/components/Screen";
import SectionHeading from "@/components/SectionHeading";
import { getMode } from "@/theme/transitModes";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

export default function WrappedScreen() {
  const router = useRouter();
  const profile = useTransitStore((state) => state.profile);
  const recentRides = useTransitStore((state) => state.recentRides);
  const currency = useTransitStore((state) => state.settings.currency);

  const year = new Date().getFullYear();

  // Everything here is derived from real rides — a year in review that invents
  // its own numbers is worse than one that admits the year has just started.
  const wrapped = useMemo(() => {
    const rides = recentRides.filter(
      (ride) => ride.startTime.getFullYear() === year
    );
    if (!rides.length) return null;

    const byMode = {};
    const byRoute = {};
    let minutes = 0;
    let km = 0;
    let fare = 0;

    for (const ride of rides) {
      byMode[ride.vehicleType] = (byMode[ride.vehicleType] ?? 0) + 1;
      byRoute[ride.route] = (byRoute[ride.route] ?? 0) + 1;
      minutes += ride.durationMin;
      km += ride.distanceKm;
      fare += ride.fare;
    }

    const top = (tally) =>
      Object.entries(tally).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const [topModeKey, topModeCount] = top(byMode);
    const [topRoute, topRouteCount] = top(byRoute);

    return {
      rides: rides.length,
      hours: Math.round(minutes / 60),
      km: Math.round(km),
      fare,
      mode: getMode(topModeKey),
      topModeCount,
      topRoute,
      topRouteCount,
    };
  }, [recentRides, year]);

  return (
    <Screen>
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

      <SectionHeading eyebrow={`${year} in review`} title="Dash Wrapped" />

      {!wrapped ? (
        <Text className="font-jk text-brand-muted text-[13px] leading-[20px]">
          Your {year} Wrapped builds itself as you travel. Log a few trips and
          your top mode, hours and busiest route will appear here.
        </Text>
      ) : (
        <>
          {/* Shareable story frame — 9:16-ish so it drops into a status */}
          <View className="rounded-3xl border border-brand-hairline bg-white p-6 aspect-[9/14] justify-between overflow-hidden">
            <View>
              <Text className="font-jk-black text-brand-black text-[11px] tracking-[3px]">
                DASH WRAPPED
              </Text>
              <Text className="font-jk-semi text-brand-slate text-[12px] mt-1">
                {profile.name || "You"} · {year}
              </Text>
            </View>

            <View>
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-black">
                <wrapped.mode.Icon size={30} color="#FFFFFF" strokeWidth={2.1} />
              </View>
              <Text className="font-jk-black text-brand-black text-[40px] leading-[44px] mt-3">
                You are a{"\n"}
                {wrapped.mode.label}{"\n"}Person.
              </Text>
              <Text className="font-jk text-brand-slate text-[14px] leading-[20px] mt-4">
                {wrapped.rides} {wrapped.rides === 1 ? "ride" : "rides"} ·{" "}
                {wrapped.hours} {wrapped.hours === 1 ? "hour" : "hours"}
                {wrapped.km > 0 ? ` · ${wrapped.km} km` : ""}.
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="rounded-full bg-brand-black px-3 py-1.5">
                <Text className="font-jk-black text-brand-white text-[10px] tracking-[1.5px]">
                  {wrapped.topModeCount} × {wrapped.mode.label.toUpperCase()}
                </Text>
              </View>
              <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[1.5px]">
                DASH.APP
              </Text>
            </View>
          </View>

          <View className="flex-row gap-x-3">
            <Pressable
              onPress={() => impact("medium")}
              accessibilityRole="button"
              accessibilityLabel="Share to status"
              className="flex-1 h-12 flex-row items-center justify-center gap-x-2 rounded-2xl bg-brand-black active:opacity-80"
            >
              <Share2 size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text className="font-jk-bold text-brand-white text-[14px]">
                Share to status
              </Text>
            </Pressable>
            <Pressable
              onPress={() => impact("light")}
              accessibilityRole="button"
              accessibilityLabel="Download story card"
              className="h-12 w-12 items-center justify-center rounded-2xl border border-brand-border bg-brand-white active:opacity-70"
            >
              <Download size={17} color="#52525B" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View className="gap-y-2.5">
            {[
              {
                label: "Top mode",
                value: wrapped.mode.label,
                detail: `${wrapped.topModeCount} of ${wrapped.rides} rides`,
              },
              {
                label: "Hours in transit",
                value: `${wrapped.hours}`,
                detail: `across ${wrapped.rides} ${wrapped.rides === 1 ? "trip" : "trips"}`,
              },
              {
                label: "Busiest route",
                value: wrapped.topRoute ?? "—",
                detail: `${wrapped.topRouteCount} ${wrapped.topRouteCount === 1 ? "trip" : "trips"}`,
              },
              {
                label: "Spent",
                value: `${currency} ${wrapped.fare}`,
                detail: "on fares this year",
              },
            ].map((card) => (
              <View
                key={card.label}
                className="flex-row items-center justify-between rounded-2xl border border-brand-hairline bg-white p-4"
              >
                <View className="flex-1 pr-3">
                  <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[1.5px]">
                    {card.label.toUpperCase()}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="font-jk-black text-brand-black text-[18px] mt-1"
                  >
                    {card.value}
                  </Text>
                </View>
                <Text className="font-jk text-brand-muted text-[12px]">
                  {card.detail}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
