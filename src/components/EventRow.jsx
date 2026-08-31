import { Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

import { daysUntil, dueLabel } from "@/lib/dates";
import { eventLabel } from "@/theme/units";
import { impact, notify } from "@/lib/haptics";
import RowAction from "@/components/RowAction";

/**
 * One dated thing: an assignment, a CAT, an exam, a meeting.
 *
 * Overdue is the only state worth colouring. A student with fourteen items
 * needs the two that are on fire to stand out, and colour spent on the other
 * twelve is colour wasted.
 */
export default function EventRow({ event, unit, onToggle, onRemove, last = false }) {
  const days = daysUntil(event.at);
  const overdue = !event.done && days !== null && days < 0;

  const meta = [unit?.code, eventLabel(event)].filter(Boolean).join(" · ");

  return (
    <View
      className={`flex-row items-start py-3.5 ${last ? "" : "border-b border-line"}`}
    >
      <Pressable
        onPress={() => {
          impact("light");
          if (!event.done) notify("success");
          onToggle?.();
        }}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: event.done }}
        accessibilityLabel={event.title}
        className={`h-[22px] w-[22px] items-center justify-center rounded-full border mr-3.5 mt-0.5 active:opacity-60 ${
          event.done ? "border-primary bg-primary" : "border-line bg-canvas"
        }`}
      >
        {event.done ? <Check size={13} color="#FFFFFF" strokeWidth={2.4} /> : null}
      </Pressable>

      <View className="flex-1">
        <Text
          numberOfLines={2}
          className={`font-jk-med text-[14.5px] leading-[20px] ${
            event.done ? "text-muted line-through" : "text-ink"
          }`}
        >
          {event.title}
        </Text>

        <Text
          className={`text-[12px] mt-1 ${
            event.done
              ? "font-jk text-muted"
              : overdue
                ? "font-jk-med text-danger"
                : "font-jk text-muted"
          }`}
        >
          {meta ? `${meta} · ` : ""}
          {event.done ? "Done" : dueLabel(event.at)}
        </Text>
      </View>

      {/* Red, and it means it: a deadline has no archive and does not come
          back. The tick beside it is the reversible one, which is the whole
          reason these two must not look alike. */}
      {onRemove ? (
        <RowAction
          Icon={X}
          tone="danger"
          label={`Delete ${event.title}`}
          onPress={onRemove}
        />
      ) : null}
    </View>
  );
}
