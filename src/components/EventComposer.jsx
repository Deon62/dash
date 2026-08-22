import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import Sheet from "@/components/Sheet";
import TextField from "@/components/TextField";
import Dropdown from "@/components/Dropdown";
import { EVENT_KINDS } from "@/theme/units";
import { impact, notify } from "@/lib/haptics";

/**
 * Deadline shortcuts.
 *
 * A calendar picker for "the essay is due next Friday" is three taps and a
 * mental conversion; almost every deadline a student adds is a round number of
 * days away, so those are the options.
 */
const WHEN = [
  { value: 0, label: "Today" },
  { value: 1, label: "Tomorrow" },
  { value: 3, label: "In 3 days" },
  { value: 7, label: "Next week" },
  { value: 14, label: "In 2 weeks" },
  { value: 30, label: "In a month" },
];

function isoInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

/** Sheet for adding anything with a date. Used by Home and by a unit. */
export default function EventComposer({
  visible,
  onClose,
  onSave,
  units,
  lockedUnitId,
}) {
  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState(lockedUnitId ?? null);
  const [kind, setKind] = useState("assignment");
  const [days, setDays] = useState(7);

  const canSave = title.trim().length >= 2;

  const close = () => {
    setTitle("");
    setKind("assignment");
    setDays(7);
    setUnitId(lockedUnitId ?? null);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="New event">
      <View className="gap-y-4">
        <TextField
          label="WHAT"
          value={title}
          onChangeText={setTitle}
          placeholder="Essay on distributed systems"
          autoFocus
        />

        {/* Not every deadline belongs to a unit — a scholarship form has a date
            and no lecturer, and forcing a unit on it would lose it. */}
        {lockedUnitId ? null : (
          <Dropdown
            label="UNIT"
            sheetTitle="Which unit?"
            value={unitId}
            onChange={setUnitId}
            placeholder="Not tied to a unit"
            options={[
              { value: null, label: "Not tied to a unit" },
              ...units.map((unit) => ({
                value: unit.id,
                label: unit.code,
                hint: unit.title,
              })),
            ]}
          />
        )}

        <Dropdown
          label="TYPE"
          sheetTitle="What kind?"
          value={kind}
          onChange={setKind}
          options={EVENT_KINDS.map((option) => ({
            value: option.key,
            label: option.label,
          }))}
        />

        <Dropdown
          label="DUE"
          sheetTitle="When is it due?"
          value={days}
          onChange={setDays}
          options={WHEN}
        />

        <Pressable
          onPress={() => {
            if (!canSave) return;
            impact("medium");
            notify("success");
            onSave({ title, unitId, kind, at: isoInDays(days) });
            close();
          }}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Add event"
          accessibilityState={{ disabled: !canSave }}
          className={`items-center justify-center rounded-2xl py-4 mt-1 ${
            canSave ? "bg-primary active:opacity-85" : "bg-surface"
          }`}
        >
          <Text
            className={`font-jk-med text-[15px] ${
              canSave ? "text-canvas" : "text-muted"
            }`}
          >
            Add event
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
