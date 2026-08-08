import { Text, View } from "react-native";

import Screen from "@/components/Screen";
import BadgeMedal from "@/components/BadgeMedal";
import { BADGES } from "@/theme/badges";
import { useTransitStore } from "@/store/useTransitStore";

export default function BadgesScreen() {
  const streakDays = useTransitStore((state) => state.profile.streakDays);

  const earned = BADGES.filter((badge) => badge.earned);
  const locked = BADGES.filter((badge) => !badge.earned);

  return (
    <Screen>
      <View>
        <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
          ACHIEVEMENTS
        </Text>
        <Text className="font-jk-black text-brand-black text-[23px] leading-[29px] mt-1.5">
          Badges
        </Text>
      </View>

      {/* Streak — a figure, not a card */}
      <View className="flex-row items-baseline mt-1">
        <Text className="font-jk-black text-brand-black text-[40px] leading-[44px]">
          {streakDays}
        </Text>
        <Text className="font-jk-semi text-brand-slate text-[14px] ml-2">
          day streak
        </Text>
        <Text className="font-jk text-brand-muted text-[12px] ml-auto">
          {earned.length} of {BADGES.length} earned
        </Text>
      </View>

      <BadgeGrid badges={earned} label="EARNED" />
      <BadgeGrid badges={locked} label="IN PROGRESS" />
    </Screen>
  );
}

/** Three across, no containers — the medallions do the separating. */
function BadgeGrid({ badges, label }) {
  if (!badges.length) return null;

  return (
    <View className="mt-5">
      <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
        {label}
      </Text>

      <View className="flex-row flex-wrap mt-5">
        {badges.map((badge) => (
          <View key={badge.id} className="w-1/3 items-center mb-7 px-1">
            <BadgeMedal
              Icon={badge.Icon}
              earned={badge.earned}
              progress={badge.progress}
            />
            <Text
              numberOfLines={1}
              className={`font-jk-bold text-[12px] mt-2.5 ${
                badge.earned ? "text-brand-black" : "text-brand-slate"
              }`}
            >
              {badge.title}
            </Text>
            <Text
              numberOfLines={2}
              className="font-jk text-brand-muted text-[10px] leading-[14px] text-center mt-0.5"
            >
              {badge.earned
                ? badge.detail
                : `${Math.round((badge.progress ?? 0) * 100)}% · ${badge.detail}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
