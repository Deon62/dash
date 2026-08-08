import { Text, View } from "react-native";

import { getMode } from "@/theme/transitModes";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function RideRow({ ride }) {
  const mode = getMode(ride.vehicleType);
  const { Icon } = mode;

  return (
    <View className="flex-row items-center rounded-2xl border border-brand-hairline bg-white p-3.5">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-black/[0.04]">
        <Icon size={19} color="#09090B" strokeWidth={2} />
      </View>

      <View className="flex-1 px-3">
        <Text
          numberOfLines={1}
          className="font-jk-bold text-brand-black text-[14px]"
        >
          {ride.route}
        </Text>
        <View className="flex-row items-center gap-x-2 mt-1">
          <Text className="font-jk text-brand-muted text-[11px]">
            {timeFormatter.format(ride.startTime)}
          </Text>
          <View className="h-1 w-1 rounded-full bg-brand-border" />
          <Text className="font-jk text-brand-muted text-[11px]">
            {ride.durationMin} min
          </Text>
          <View className="h-1 w-1 rounded-full bg-brand-border" />
          <Text className="font-jk text-brand-muted text-[11px]">
            {ride.distanceKm} km
          </Text>
        </View>
      </View>

      <Text className="font-jk-black text-brand-black text-[14px]">
        KES {ride.fare}
      </Text>
    </View>
  );
}
