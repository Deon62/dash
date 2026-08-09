import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Building2,
  ChevronRight,
  IdCard,
  LogOut,
  Radar,
  Upload,
  Wallet,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import AvatarPicker from "@/components/AvatarPicker";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

const ROWS = [
  { id: "p-0", label: "Personal details", value: "", Icon: IdCard, href: "/account" },
  { id: "p-1", label: "Motion detection", value: "Always on", Icon: Radar },
  { id: "p-2", label: "Home city", value: "Nairobi", Icon: Building2 },
  { id: "p-3", label: "Fare currency", value: "KES", Icon: Wallet },
  { id: "p-4", label: "Weekly recap", value: "Sundays, 8pm", Icon: Bell },
  { id: "p-5", label: "Export my data", value: "", Icon: Upload },
];

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useTransitStore((state) => state.profile);
  const logout = useTransitStore((state) => state.logout);

  return (
    <Screen>
      {/* Identity — the avatar sits well clear of the status bar */}
      <View className="items-center pt-10">
        <AvatarPicker />

        <Text className="font-jk-black text-brand-black text-[23px] mt-5">
          {profile.name}
        </Text>
        <Text className="font-jk text-brand-slate text-[13px] mt-1">
          {profile.email}
        </Text>
        <Text className="font-jk text-brand-muted text-[12px] mt-1">
          {profile.homeCity} · commuting since {profile.memberSince}
        </Text>
      </View>

      {/* Settings — borderless rows, spaced apart rather than boxed and ruled */}
      <View className="gap-y-1 mt-4">
        {ROWS.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => {
              impact("light");
              if (row.href) router.push(row.href);
            }}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            className="flex-row items-center rounded-2xl px-1 py-4 active:bg-brand-black/[0.03]"
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-black/[0.04]">
              <row.Icon size={17} color="#09090B" strokeWidth={2} />
            </View>
            <Text className="font-jk-semi text-brand-black text-[15px] flex-1 ml-3.5">
              {row.label}
            </Text>
            {row.value ? (
              <Text className="font-jk text-brand-muted text-[13px] mr-2">
                {row.value}
              </Text>
            ) : null}
            <ChevronRight size={16} color="#A1A1AA" strokeWidth={2.2} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => {
          impact("medium");
          logout();
          router.replace("/login");
        }}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        className="flex-row items-center rounded-2xl px-1 py-4 mt-3 active:bg-transit-boda-bg"
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-transit-boda-bg">
          <LogOut size={17} color="#FF3B30" strokeWidth={2} />
        </View>
        <Text className="font-jk-bold text-transit-boda text-[15px] ml-3.5">
          Log out
        </Text>
      </Pressable>
    </Screen>
  );
}
