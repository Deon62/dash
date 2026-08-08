import { Text, View } from "react-native";

export default function StatCard({ label, value, unit, caption, className = "" }) {
  return (
    <View
      className={`flex-1 rounded-2xl border border-brand-border bg-brand-white p-4 ${className}`}
    >
      <Text className="font-jk-bold text-brand-slate text-[10px] tracking-[1.5px]">
        {label.toUpperCase()}
      </Text>

      <View className="flex-row items-baseline mt-2">
        <Text className="font-jk-black text-brand-black text-[30px] leading-[34px]">
          {value}
        </Text>
        {unit ? (
          <Text className="font-jk-semi text-brand-slate text-[13px] ml-1">
            {unit}
          </Text>
        ) : null}
      </View>

      {caption ? (
        <Text className="font-jk text-brand-slate text-[11px] mt-1.5">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
