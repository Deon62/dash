import { useState } from "react";
import { View } from "react-native";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import Dropdown from "@/components/Dropdown";
import { EVENT_KINDS } from "@/theme/units";
import { notify } from "@/lib/haptics";

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
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(7);

  const canSave = title.trim().length >= 2;
  const naming = EVENT_KINDS.find((option) => option.key === kind)?.open;

  const close = () => {
    setTitle("");
    setKind("assignment");
    setLabel("");
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
            hint: option.open ? "Name it yourself" : undefined,
          }))}
        />

        {/* Only "Other" asks for a name, and even then it is optional — the
            point is to let a presentation be a presentation, not to make the
            student fill in a taxonomy before they can save a date. */}
        {naming ? (
          <TextField
            label="ACTIVITY"
            value={label}
            onChangeText={setLabel}
            placeholder="Presentation, lab sign-off, meeting…"
            autoCapitalize="sentences"
          />
        ) : null}

        <Dropdown
          label="DUE"
          sheetTitle="When is it due?"
          value={days}
          onChange={setDays}
          options={WHEN}
        />

        <Button
          label="Add event"
          disabled={!canSave}
          onPress={() => {
            notify("success");
            onSave({ title, unitId, kind, label, at: isoInDays(days) });
            close();
          }}
        />
      </View>
    </Sheet>
  );
}
