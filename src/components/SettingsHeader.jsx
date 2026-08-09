import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { impact } from "@/lib/haptics";

/** Back control, eyebrow and title — shared by every settings page. */
export default function SettingsHeader({ eyebrow, title, description }) {
  const router = useRouter();

  return (
    <View>
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

      <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px] mt-5">
        {eyebrow}
      </Text>
      <Text className="font-jk-black text-brand-black text-[23px] leading-[29px] mt-1.5">
        {title}
      </Text>
      {description ? (
        <Text className="font-jk text-brand-slate text-[13px] leading-[19px] mt-2.5">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
