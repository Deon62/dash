import { Text, View, useWindowDimensions } from "react-native";

/**
 * Centred illustration + message for a screen with nothing in it yet.
 *
 * The artwork is sized from the viewport rather than fixed, so it stays
 * proportionate on a small phone and doesn't dominate a large one.
 */
export default function EmptyState({ Art, title, message, maxWidth = 260 }) {
  const { width } = useWindowDimensions();
  const artWidth = Math.min(width * 0.6, maxWidth);

  return (
    <View className="flex-1 items-center justify-center px-4 py-10">
      {Art ? (
        <Art width={artWidth} height={artWidth * 0.78} />
      ) : null}

      <Text className="font-jk-black text-brand-black text-[18px] text-center mt-8">
        {title}
      </Text>
      <Text className="font-jk text-brand-muted text-[13px] leading-[19px] text-center mt-2">
        {message}
      </Text>
    </View>
  );
}
