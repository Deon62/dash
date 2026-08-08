import { Text, View } from "react-native";
import {
  Bike,
  CarTaxiFront,
  Globe,
  Moon,
  Sunrise,
  Wallet,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import SectionHeading from "@/components/SectionHeading";

const BADGES = [
  {
    id: "b-1",
    Icon: Sunrise,
    title: "Early Riser",
    detail: "10 trips before 7am",
    earned: true,
  },
  {
    id: "b-2",
    Icon: Bike,
    title: "Lane Splitter",
    detail: "25 boda rides",
    earned: true,
  },
  {
    id: "b-3",
    Icon: CarTaxiFront,
    title: "Three Wheeler",
    detail: "15 tuk-tuk rides",
    earned: true,
  },
  {
    id: "b-4",
    Icon: Globe,
    title: "Century Club",
    detail: "100 km in a week",
    earned: false,
  },
  {
    id: "b-5",
    Icon: Moon,
    title: "Night Owl",
    detail: "20 trips after 10pm",
    earned: false,
  },
  {
    id: "b-6",
    Icon: Wallet,
    title: "Fare Hawk",
    detail: "Log 50 fares",
    earned: false,
  },
];

export default function BadgesScreen() {
  const earned = BADGES.filter((badge) => badge.earned).length;

  return (
    <Screen>
      {/* Streak banner */}
      <View className="rounded-3xl bg-brand-black p-5">
        <Text className="font-jk-bold text-[10px] tracking-[2px] text-white/60">
          CURRENT STREAK
        </Text>
        <View className="flex-row items-baseline mt-2">
          <Text className="font-jk-black text-brand-white text-[44px] leading-[48px]">
            12
          </Text>
          <Text className="font-jk-semi text-white/70 text-[15px] ml-2">
            days commuting
          </Text>
        </View>
        <Text className="font-jk text-white/60 text-[12px] mt-2">
          Your longest run yet. Miss a weekday and it resets.
        </Text>
      </View>

      <SectionHeading
        eyebrow="Achievements"
        title="Badges"
        action={`${earned}/${BADGES.length}`}
      />

      <View className="flex-row flex-wrap justify-between gap-y-3">
        {BADGES.map((badge) => {
          return (
            <View
              key={badge.id}
              className={`w-[48.5%] rounded-2xl border border-brand-hairline p-4 ${
                badge.earned ? "bg-white" : "bg-white opacity-45"
              }`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-xl ${
                  badge.earned ? "bg-brand-black" : "bg-brand-black/[0.05]"
                }`}
              >
                <badge.Icon
                  size={19}
                  color={badge.earned ? "#FFFFFF" : "#52525B"}
                  strokeWidth={2}
                />
              </View>
              <Text className="font-jk-black text-brand-black text-[14px] mt-2.5">
                {badge.title}
              </Text>
              <Text className="font-jk text-brand-muted text-[11px] leading-[16px] mt-1">
                {badge.detail}
              </Text>
              <Text
                className={`font-jk-bold text-[9px] tracking-[1.5px] mt-3 ${
                  badge.earned ? "text-brand-black" : "text-brand-muted"
                }`}
              >
                {badge.earned ? "EARNED" : "LOCKED"}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
