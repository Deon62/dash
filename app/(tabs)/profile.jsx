import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Building2,
  ChevronRight,
  Radar,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

const ROWS = [
  { id: "p-1", label: "Motion detection", value: "Always on", Icon: Radar },
  { id: "p-2", label: "Home city", value: "Nairobi", Icon: Building2 },
  { id: "p-3", label: "Fare currency", value: "KES", Icon: Wallet },
  { id: "p-4", label: "Weekly recap", value: "Sundays, 8pm", Icon: Bell },
  { id: "p-5", label: "Export my data", value: "", Icon: Upload },
];

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useTransitStore((state) => state.profile);
  const recentRides = useTransitStore((state) => state.recentRides);

  return (
    <Screen>
      <View className="items-center rounded-3xl border border-brand-hairline bg-white p-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-black">
          <Text className="font-jk-black text-brand-white text-[26px] tracking-[1px]">
            {profile.initials}
          </Text>
        </View>
        <Text className="font-jk-black text-brand-black text-[22px] mt-4">
          {profile.name}
        </Text>
        <Text className="font-jk text-brand-muted text-[12px] mt-1">
          {profile.homeCity} · commuting since {profile.memberSince}
        </Text>

        <View className="flex-row w-full mt-6 pt-5 border-t border-brand-hairline">
          {[
            { label: "RIDES", value: recentRides.length },
            { label: "BADGES", value: 3 },
            { label: "STREAK", value: 12 },
          ].map((stat) => (
            <View key={stat.label} className="flex-1 items-center">
              <Text className="font-jk-black text-brand-black text-[20px]">
                {stat.value}
              </Text>
              <Text className="font-jk-bold text-brand-muted text-[9px] tracking-[1.5px] mt-0.5">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Wrapped lives here rather than in the tab bar — it's a once-a-year moment. */}
      <Pressable
        onPress={() => {
          impact("light");
          router.push("/wrapped");
        }}
        accessibilityRole="button"
        accessibilityLabel="Open Transit Wrapped"
        className="flex-row items-center rounded-3xl bg-brand-black p-5 active:opacity-85"
      >
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <Sparkles size={20} color="#FFFFFF" strokeWidth={2.1} />
        </View>
        <View className="flex-1 px-3.5">
          <Text className="font-jk-black text-brand-white text-[16px]">
            Transit Wrapped
          </Text>
          <Text className="font-jk text-white/60 text-[12px] mt-0.5">
            Your 2026 commute, in one card
          </Text>
        </View>
        <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      <View className="rounded-3xl border border-brand-hairline bg-white overflow-hidden">
        {ROWS.map((row, index) => (
          <Pressable
            key={row.id}
            onPress={() => impact("light")}
            className={`flex-row items-center px-4 py-4 active:bg-brand-canvas ${
              index > 0 ? "border-t border-brand-hairline" : ""
            }`}
          >
            <View className="w-7">
              <row.Icon size={17} color="#52525B" strokeWidth={2} />
            </View>
            <Text className="font-jk-semi text-brand-black text-[14px] flex-1">
              {row.label}
            </Text>
            <Text className="font-jk text-brand-muted text-[12px] mr-1.5">
              {row.value}
            </Text>
            <ChevronRight size={15} color="#A1A1AA" strokeWidth={2.2} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
