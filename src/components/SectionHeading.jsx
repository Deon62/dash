import { Text, View } from "react-native";

export default function SectionHeading({ eyebrow, title, action }) {
  return (
    <View className="flex-row items-end justify-between">
      <View className="flex-1 pr-3">
        {eyebrow ? (
          <Text className="font-jk-bold text-brand-slate text-[10px] tracking-[2px]">
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text className="font-jk-black text-brand-black text-[19px] leading-[25px] mt-1">
          {title}
        </Text>
      </View>
      {action ? (
        <Text className="font-jk-semi text-brand-slate text-[12px]">{action}</Text>
      ) : null}
    </View>
  );
}
