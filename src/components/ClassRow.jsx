import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { formatTime, minutesOf, nowMinutes } from "@/lib/dates";
import { impact } from "@/lib/haptics";

/**
 * One slot on the timetable.
 *
 * `live` is worked out here rather than passed in so every caller gets the
 * highlight for free — a student glancing at Home should see which class they
 * are supposed to be sitting in right now. That highlight is the one place
 * the blue earns its keep on this screen.
 */
export default function ClassRow({ entry, unit, today = false, onRemove, last = false }) {
  const start = minutesOf(entry.start);
  const end = minutesOf(entry.end);
  const now = nowMinutes();
  const live = today && now >= start && now < end;
  const past = today && now >= end;

  return (
    <View
      className={`flex-row items-center py-3.5 ${last ? "" : "border-b border-line"} ${
        past ? "opacity-40" : ""
      }`}
    >
      <View className="w-[58px]">
        <Text
          className={`text-[13px] ${live ? "font-jk-semi text-primary" : "font-jk-med text-ink"}`}
        >
          {formatTime(entry.start)}
        </Text>
        <Text className="font-jk text-muted text-[11px] mt-0.5">
          {formatTime(entry.end)}
        </Text>
      </View>

      {/* A hairline rule rather than a coloured spine: it separates the clock
          from the class without adding another colour to the page. */}
      <View
        className={`w-px self-stretch mr-4 ${live ? "bg-primary" : "bg-line"}`}
      />

      <View className="flex-1">
        <View className="flex-row items-center gap-x-2">
          <Text className="font-jk-semi text-ink text-[14px]">
            {unit?.code ?? "—"}
          </Text>
          {live ? (
            <Text className="font-jk-med text-primary text-[10px] tracking-[0.8px]">
              NOW
            </Text>
          ) : null}
        </View>

        <Text numberOfLines={1} className="font-jk text-muted text-[12.5px] mt-0.5">
          {[unit?.title, entry.room].filter(Boolean).join(" · ") || "Unknown unit"}
        </Text>
      </View>

      {onRemove ? (
        <Pressable
          onPress={() => {
            impact("light");
            onRemove();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${unit?.code ?? "class"} at ${formatTime(entry.start)}`}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
        >
          <X size={15} color="#71717A" strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}
