import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Building2,
  ChevronRight,
  IdCard,
  LogOut,
  Radar,
  Trash2,
  Wallet,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import AvatarPicker from "@/components/AvatarPicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

/**
 * `toggle` rows switch in place; the rest push a page. Values are resolved
 * from state at render so a row can never show stale copy.
 */
const ROWS = [
  { id: "details", label: "Personal details", Icon: IdCard, href: "/account" },
  { id: "motion", label: "Motion detection", Icon: Radar, toggle: true },
  { id: "city", label: "Home city", Icon: Building2, href: "/settings/home-city" },
  { id: "currency", label: "Fare currency", Icon: Wallet, href: "/settings/currency" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useTransitStore((state) => state.profile);
  const settings = useTransitStore((state) => state.settings);
  const updateSettings = useTransitStore((state) => state.updateSettings);
  const logout = useTransitStore((state) => state.logout);
  const deleteAccount = useTransitStore((state) => state.deleteAccount);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const values = { city: profile.homeCity, currency: settings.currency };

  return (
    <Screen>
      <View className="items-center pt-10">
        <AvatarPicker />

        <Text className="font-jk-black text-brand-black text-[23px] mt-5">
          {profile.name}
        </Text>
        <Text className="font-jk text-brand-slate text-[13px] mt-1">
          {profile.phone || profile.email}
        </Text>
        <Text className="font-jk text-brand-muted text-[12px] mt-1">
          {profile.homeCity} · commuting since {profile.memberSince}
        </Text>
      </View>

      <View className="gap-y-1 mt-4">
        {ROWS.map((row) => {
          const content = (
            <>
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-black/[0.04]">
                <row.Icon size={17} color="#09090B" strokeWidth={2} />
              </View>
              <Text className="font-jk-semi text-brand-black text-[15px] flex-1 ml-3.5">
                {row.label}
              </Text>
            </>
          );

          if (row.toggle) {
            return (
              <View
                key={row.id}
                className="flex-row items-center rounded-2xl px-1 py-3"
              >
                {content}
                <Switch
                  value={settings.motionDetection}
                  onValueChange={(value) => {
                    impact("light");
                    updateSettings({ motionDetection: value });
                  }}
                  accessibilityLabel="Motion detection"
                  trackColor={{ false: "#E5E7EB", true: "#09090B" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E7EB"
                />
              </View>
            );
          }

          return (
            <Pressable
              key={row.id}
              onPress={() => {
                impact("light");
                router.push(row.href);
              }}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              className="flex-row items-center rounded-2xl px-1 py-4 active:bg-brand-black/[0.03]"
            >
              {content}
              {values[row.id] ? (
                <Text className="font-jk text-brand-muted text-[13px] mr-2">
                  {values[row.id]}
                </Text>
              ) : null}
              <ChevronRight size={16} color="#A1A1AA" strokeWidth={2.2} />
            </Pressable>
          );
        })}
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

      <Pressable
        onPress={() => {
          impact("light");
          setConfirmingDelete(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
        className="flex-row items-center rounded-2xl px-1 py-4 active:bg-brand-black/[0.03]"
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-black/[0.04]">
          <Trash2 size={17} color="#52525B" strokeWidth={2} />
        </View>
        <Text className="font-jk-semi text-brand-slate text-[15px] ml-3.5">
          Delete my account
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete your account?"
        message="This removes your profile and every ride you've logged. It can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          deleteAccount();
          router.replace("/login");
        }}
      />
    </Screen>
  );
}
