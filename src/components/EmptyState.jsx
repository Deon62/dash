import { Text, View } from "react-native";

/**
 * Centred message for a section with nothing in it yet.
 *
 * The glyph sits in a soft disc rather than floating: an outline icon alone on
 * white reads as something that failed to load.
 */
export default function EmptyState({ Icon, title, message, action, compact = false }) {
  return (
    <View className={`items-center ${compact ? "py-8" : "py-12"}`}>
      {Icon ? (
        <View className="h-14 w-14 items-center justify-center rounded-full bg-surface">
          <Icon size={22} color="#71717A" strokeWidth={1.6} />
        </View>
      ) : null}

      <Text className="font-jk-semi text-ink text-[15px] text-center mt-5">
        {title}
      </Text>
      <Text className="font-jk text-muted text-[13px] leading-[19px] text-center mt-1.5 px-4">
        {message}
      </Text>

      {action ? <View className="mt-6">{action}</View> : null}
    </View>
  );
}
