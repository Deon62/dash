import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import Dropdown from "@/components/Dropdown";
import DatePicker from "@/components/DatePicker";
import { COLORS } from "@/theme/colors";
import { dayKey, dueLabel } from "@/lib/dates";
import { EVENT_KINDS } from "@/theme/units";
import { notify } from "@/lib/haptics";

/**
 * Deadline shortcuts.
 *
 * A calendar picker for "the essay is due next Friday" is three taps and a
 * mental conversion; almost every deadline a student adds is a round number of
 * days away, so those are the options.
 */
function isoInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

/**
 * The two dates worth a shortcut.
 *
 * Anything further out is easier to find on a calendar than to count in days —
 * "in 3 days" makes a student do arithmetic to check it is not the weekend.
 */
const QUICK = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
];

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
  const [at, setAt] = useState(() => isoInDays(7));

  const canSave = title.trim().length >= 2;
  const naming = EVENT_KINDS.find((option) => option.key === kind)?.open;

  const close = () => {
    setTitle("");
    setKind("assignment");
    setLabel("");
    setAt(isoInDays(7));
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

        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px]">
              DUE
            </Text>

            <View className="flex-row gap-x-2">
              {QUICK.map((option) => {
                const isoValue = isoInDays(option.days);
                const active = dayKey(at) === dayKey(isoValue);

                return (
                  <Pressable
                    key={option.label}
                    onPress={() => setAt(isoValue)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={option.label}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      backgroundColor: active ? COLORS.ink : COLORS.surface,
                    }}
                    className="active:opacity-70"
                  >
                    <Text
                      style={{ color: active ? COLORS.canvas : COLORS.muted }}
                      className="font-jk-med text-[12px]"
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <DatePicker value={at} onChange={setAt} />

          <Text className="font-jk text-muted text-[12px] mt-1">
            {dueLabel(at)}
          </Text>
        </View>

        <Button
          label="Add event"
          disabled={!canSave}
          onPress={() => {
            notify("success");
            onSave({ title, unitId, kind, label, at });
            close();
          }}
        />
      </View>
    </Sheet>
  );
}
