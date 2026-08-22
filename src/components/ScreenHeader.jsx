import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/** Fixed so no parent can stretch the circle into a lozenge. */
const DISC = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: COLORS.surface,
};

/**
 * Back control, title and an optional right-hand action.
 *
 * There is no description slot. A paragraph under every heading explaining
 * what the page is turns into wallpaper by the second visit — the title and
 * what is actually on the page say it, and anything genuinely load-bearing
 * belongs next to the control it qualifies.
 *
 * The arrow has a shaft — `←`, not `‹`. A bare chevron at this size is easy to
 * read as a list disclosure pointing the wrong way; an arrow only ever means
 * "back".
 */
export default function ScreenHeader({ title, right, onBack }) {
  const router = useRouter();

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            impact("light");
            if (onBack) onBack();
            else router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={DISC}
          className="active:opacity-60"
        >
          <ArrowLeft size={18} color="#09090B" strokeWidth={1.8} />
        </Pressable>

        {right ?? null}
      </View>

      {title ? (
        <Text className="font-jk-bold text-ink text-[30px] leading-[37px] mt-6">
          {title}
        </Text>
      ) : null}
    </View>
  );
}
