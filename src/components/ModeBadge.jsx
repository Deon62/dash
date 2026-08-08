import { Text, View } from "react-native";

import { getMode } from "@/theme/transitModes";

/** Neutral pill showing a transit mode — monochrome, no accent fill. */
export default function ModeBadge({ vehicleType, size = "md" }) {
  const mode = getMode(vehicleType);
  const compact = size === "sm";
  const { Icon } = mode;

  return (
    <View
      className={`flex-row items-center rounded-full border border-brand-hairline bg-white ${
        compact ? "px-2 py-[3px] gap-x-1" : "px-2.5 py-1 gap-x-1.5"
      }`}
    >
      <Icon size={compact ? 11 : 13} color="#52525B" strokeWidth={2.2} />
      <Text
        className={`font-jk-bold text-brand-black tracking-[0.4px] ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        {mode.label}
      </Text>
    </View>
  );
}
