import { Pressable, Text, View } from "react-native";
import { useState } from "react";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { ChevronRight, List, Play, Square } from "lucide-react-native";

import FarePrompt from "@/components/FarePrompt";

import { MODE_KEYS, TRANSIT_MODES, getMode } from "@/theme/transitModes";
import { SHEET_PEEK_HEIGHT } from "@/theme/layout";
import { useTransitStore } from "@/store/useTransitStore";
import { impact, notify } from "@/lib/haptics";

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
  const router = useRouter();
  const [askingFare, setAskingFare] = useState(false);
  const activeTrip = useTransitStore((state) => state.activeTrip);
  const recentRides = useTransitStore((state) => state.recentRides);
  const toggleDetection = useTransitStore((state) => state.toggleDetection);
  const startTrip = useTransitStore((state) => state.startTrip);
  const endTrip = useTransitStore((state) => state.endTrip);

  const onTrip = Boolean(activeTrip.vehicleType);
  const activeMode = onTrip ? getMode(activeTrip.vehicleType) : null;

  return (
    <BottomSheetScrollView
      // One source of truth for the container: adding contentContainerClassName
      // alongside this would silently drop the classes.
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: bottomPadding + 32,
      }}
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
              // Ending a trip asks for the fare before it's written to history.
              if (onTrip) setAskingFare(true);
              else toggleDetection();
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
      {/* Three across — nine modes as a fixed grid rather than a ragged wrap */}
      <View className="flex-row flex-wrap mt-3.5">
        {MODE_KEYS.map((key) => {
          const mode = TRANSIT_MODES[key];
          const selected = activeTrip.vehicleType === key;

          return (
            <View key={key} className="w-1/3 p-1">
              <Pressable
                onPress={() => {
                  impact("light");
                  startTrip(key);
                }}
                accessibilityRole="button"
                accessibilityLabel={mode.label}
                accessibilityState={selected ? { selected: true } : {}}
                className={`items-center justify-center rounded-2xl border py-4 active:opacity-70 ${
                  selected
                    ? "border-brand-black bg-brand-black"
                    : "border-brand-hairline bg-white"
                }`}
              >
                <mode.Icon
                  size={20}
                  color={selected ? "#FFFFFF" : "#52525B"}
                  strokeWidth={2.1}
                />
                <Text
                  numberOfLines={1}
                  className={`font-jk-bold text-[11px] mt-2 ${
                    selected ? "text-brand-white" : "text-brand-black"
                  }`}
                >
                  {mode.label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* The full history is its own page — the sheet just points at it. */}
      <Pressable
        onPress={() => {
          impact("light");
          router.push("/rides");
        }}
        accessibilityRole="button"
        accessibilityLabel="All rides"
        className="flex-row items-center rounded-2xl border border-brand-hairline bg-white px-4 py-4 mt-6 active:opacity-70"
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-black/[0.04]">
          <List size={17} color="#09090B" strokeWidth={2} />
        </View>
        <View className="flex-1 ml-3.5">
          <Text className="font-jk-bold text-brand-black text-[14px]">
            All rides
          </Text>
          <Text className="font-jk text-brand-muted text-[11px] mt-0.5">
            {recentRides.length} logged
          </Text>
        </View>
        <ChevronRight size={16} color="#A1A1AA" strokeWidth={2.2} />
      </Pressable>

      <FarePrompt
        visible={askingFare}
        modeLabel={activeMode?.label}
        onSubmit={(fare) => {
          setAskingFare(false);
          endTrip(fare);
          notify("success");
        }}
        onSkip={() => {
          setAskingFare(false);
          endTrip(0);
        }}
      />
    </BottomSheetScrollView>
  );
}
