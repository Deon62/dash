import { Pressable, Text, View } from "react-native";

import { impact } from "@/lib/haptics";

/** Section label with an optional action on the right. */
export default function SectionHeading({ title, caption, action, onAction }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="font-jk-semi text-ink text-[16px]">{title}</Text>
        {caption ? (
          <Text className="font-jk text-muted text-[12.5px] mt-0.5">{caption}</Text>
        ) : null}
      </View>

      {action ? (
        <Pressable
          onPress={() => {
            impact("light");
            onAction?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Text className="font-jk-med text-indigo text-[13px]">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
