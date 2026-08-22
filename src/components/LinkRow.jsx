import { Pressable, Switch, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { impact } from "@/lib/haptics";

/**
 * One row in a list of destinations.
 *
 * Rows sit directly on the page separated by a hairline, not boxed in cards.
 * A card around every link doubles the borders on the screen and makes six
 * settings look like six unrelated features.
 */
export default function LinkRow({
  Icon,
  label,
  value,
  hint,
  onPress,
  toggle = false,
  toggleValue,
  onToggle,
  destructive = false,
  last = false,
}) {
  const body = (
    <>
      {Icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
          <Icon
            size={16}
            color={destructive ? "#DC2626" : "#09090B"}
            strokeWidth={1.8}
          />
        </View>
      ) : null}

      <View className="flex-1 ml-3.5 pr-3">
        <Text
          className={`font-jk-med text-[15px] ${
            destructive ? "text-danger" : "text-ink"
          }`}
        >
          {label}
        </Text>
        {hint ? (
          <Text className="font-jk text-muted text-[12px] leading-[17px] mt-0.5">
            {hint}
          </Text>
        ) : null}
      </View>
    </>
  );

  const border = last ? "" : "border-b border-line";

  if (toggle) {
    return (
      <View className={`flex-row items-center py-3.5 ${border}`}>
        {body}
        <Switch
          value={toggleValue}
          onValueChange={(next) => {
            impact("light");
            onToggle?.(next);
          }}
          accessibilityLabel={label}
          trackColor={{ false: "#E4E4E7", true: "#007FFA" }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E4E4E7"
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center py-4 active:opacity-60 ${border}`}
    >
      {body}
      {value ? (
        <Text className="font-jk text-muted text-[13px] mr-2">{value}</Text>
      ) : null}
      <ChevronRight size={17} color="#71717A" strokeWidth={1.8} />
    </Pressable>
  );
}
