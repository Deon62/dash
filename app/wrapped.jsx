import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Download, Share2 } from "lucide-react-native";

import Screen from "@/components/Screen";
import SectionHeading from "@/components/SectionHeading";
import { TRANSIT_MODES } from "@/theme/transitModes";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

const STORY_CARDS = [
  { id: "s-1", label: "Top mode", value: "Matatu", detail: "168 of 241 rides" },
  { id: "s-2", label: "Hours in transit", value: "94", detail: "≈ 4 full days" },
  { id: "s-3", label: "Busiest route", value: "Route 46", detail: "62 trips" },
];

export default function WrappedScreen() {
  const router = useRouter();
  const name = useTransitStore((state) => state.profile.name);
  const topMode = TRANSIT_MODES.matatu;

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

      <SectionHeading eyebrow="2026 in review" title="Transit Wrapped" />

      {/* The shareable story frame — 9:16-ish so it drops straight into a status */}
      <View className="rounded-3xl border border-brand-hairline bg-white p-6 aspect-[9/14] justify-between overflow-hidden">
        <View>
          <Text className="font-jk-black text-brand-black text-[11px] tracking-[3px]">
            TRANSIT WRAPPED
          </Text>
          <Text className="font-jk-semi text-brand-slate text-[12px] mt-1">
            {name} · 2026
          </Text>
        </View>

        <View>
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-black">
            <topMode.Icon size={30} color="#FFFFFF" strokeWidth={2.1} />
          </View>
          <Text className="font-jk-black text-brand-black text-[44px] leading-[46px] mt-3">
            You are a{"\n"}Matatu{"\n"}Person.
          </Text>
          <Text className="font-jk text-brand-slate text-[14px] leading-[20px] mt-4">
            241 rides. 94 hours. 1,812 km of Nairobi, mostly stuck at Globe
            roundabout.
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="rounded-full bg-brand-black px-3 py-1.5">
            <Text className="font-jk-black text-brand-white text-[10px] tracking-[1.5px]">
              TOP 3% IN NAIROBI
            </Text>
          </View>
          <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[1.5px]">
            TRANSIT.APP
          </Text>
        </View>
      </View>

      <View className="flex-row gap-x-3">
        <Pressable
          onPress={() => impact("medium")}
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
        {STORY_CARDS.map((card) => (
          <View
            key={card.id}
            className="flex-row items-center justify-between rounded-2xl border border-brand-border bg-brand-white p-4"
          >
            <View>
              <Text className="font-jk-bold text-brand-slate text-[10px] tracking-[1.5px]">
                {card.label.toUpperCase()}
              </Text>
              <Text className="font-jk-black text-brand-black text-[20px] mt-1">
                {card.value}
              </Text>
            </View>
            <Text className="font-jk text-brand-slate text-[12px]">
              {card.detail}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
