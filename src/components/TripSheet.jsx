import { Pressable, Text, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Play, Square } from "lucide-react-native";

import RideRow from "@/components/RideRow";
import { MODE_KEYS, TRANSIT_MODES, getMode } from "@/theme/transitModes";
import { SHEET_PEEK_HEIGHT } from "@/theme/layout";
import { useTransitStore } from "@/store/useTransitStore";
import { impact, notify } from "@/lib/haptics";

/** Ride history goes back a year; the sheet only ever shows the newest few. */
const RECENT_LIMIT = 6;

/**
 * Contents of the pull-up trip sheet.
 *
 * The peek block is a fixed height matched to the collapsed snap point, so at
 * rest the user sees the status card and nothing else — the mode picker and
 * ride history begin below the fold and only appear once the sheet is dragged.
 *
 * There is no "pull up" copy: the sheet's top shadow and centred grab handle
 * already read as draggable, the way Bolt's does.
 */
export default function TripSheet({ bottomPadding = 0 }) {
  const activeTrip = useTransitStore((state) => state.activeTrip);
  const recentRides = useTransitStore((state) => state.recentRides);
  const toggleDetection = useTransitStore((state) => state.toggleDetection);
  const startTrip = useTransitStore((state) => state.startTrip);
  const endTrip = useTransitStore((state) => state.endTrip);

  const onTrip = Boolean(activeTrip.vehicleType);
  const activeMode = onTrip ? getMode(activeTrip.vehicleType) : null;

  return (
    <BottomSheetScrollView
      contentContainerStyle={{ paddingBottom: bottomPadding + 32 }}
      contentContainerClassName="px-5"
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Peek: everything visible at rest ----
          The block is padded out by the height of the bottom bar so that the
          content after it begins exactly at the collapsed boundary. Sizing it
          to the card alone left the next heading showing above the bar. */}
      <View style={{ height: SHEET_PEEK_HEIGHT + bottomPadding }} className="pt-2.5">
        <View className="flex-row items-center justify-between">
          <Text
            numberOfLines={1}
            className="font-jk-black text-brand-black text-[27px] leading-[33px] flex-1 pr-4"
          >
            {onTrip ? `On a ${activeMode.label}` : "You're moving"}
          </Text>

          <Pressable
            onPress={() => {
              impact("medium");
              if (onTrip) {
                endTrip();
                notify("success");
              } else {
                toggleDetection();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={onTrip ? "End trip" : "Start detecting"}
            className="h-12 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-black px-5 active:opacity-80"
          >
            {onTrip ? (
              <Square size={13} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
            ) : (
              <Play size={13} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
            )}
            <Text className="font-jk-bold text-brand-white text-[13px]">
              {onTrip ? "End" : activeTrip.isDetecting ? "Pause" : "Start"}
            </Text>
          </Pressable>
        </View>

      </View>

      {/* ---- Below the fold ---- */}
      <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px] mt-1">
        HOW ARE YOU TRAVELLING
      </Text>
      <View className="flex-row flex-wrap gap-2.5 mt-3.5">
        {MODE_KEYS.map((key) => {
          const mode = TRANSIT_MODES[key];
          const selected = activeTrip.vehicleType === key;

          return (
            <Pressable
              key={key}
              onPress={() => {
                impact("light");
                startTrip(key);
              }}
              accessibilityRole="button"
              accessibilityLabel={mode.label}
              className={`flex-row items-center gap-x-2 rounded-2xl border px-3.5 py-3 active:opacity-70 ${
                selected
                  ? "border-brand-black bg-brand-black"
                  : "border-brand-hairline bg-white"
              }`}
            >
              <mode.Icon
                size={17}
                color={selected ? "#FFFFFF" : "#52525B"}
                strokeWidth={2.1}
              />
              <Text
                className={`font-jk-bold text-[13px] ${
                  selected ? "text-brand-white" : "text-brand-black"
                }`}
              >
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="h-px bg-brand-hairline my-6" />

      <View className="flex-row items-end justify-between">
        <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[2px]">
          RECENT RIDES
        </Text>
        <Text className="font-jk text-brand-muted text-[11px]">
          {recentRides.length} logged
        </Text>
      </View>

      {/* History runs back a year; the sheet shows only the newest handful. */}
      <View className="gap-y-2.5 mt-3.5">
        {recentRides.slice(0, RECENT_LIMIT).map((ride) => (
          <RideRow key={ride.id} ride={ride} />
        ))}
      </View>
    </BottomSheetScrollView>
  );
}
