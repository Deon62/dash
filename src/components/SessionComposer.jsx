import { useState } from "react";
import { Text, View } from "react-native";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import Dropdown from "@/components/Dropdown";
import { DAYS } from "@/theme/units";
import { formatTime, minutesOf } from "@/lib/dates";
import { notify } from "@/lib/haptics";

/**
 * Half-hour slots from 07:00 to 21:00.
 *
 * A dropdown of fixed slots rather than a typed "HH:MM": university timetables
 * land on the hour or the half hour almost without exception, and a text field
 * invites "8", "8am" and "0800" — three things to parse for no gain.
 */
const TIMES = Array.from({ length: 29 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
  return { value, label: formatTime(value) };
});

/** Sheet for adding a slot to the timetable. */
export default function SessionComposer({ visible, onClose, onSave, units, lockedUnitId }) {
  const [unitId, setUnitId] = useState(lockedUnitId ?? units[0]?.id ?? null);
  const [day, setDay] = useState(new Date().getDay());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");

  const ordered = minutesOf(end) > minutesOf(start);
  const canSave = Boolean(unitId) && ordered;

  const close = () => {
    setRoom("");
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Add a session">
      <View className="gap-y-4">
        {lockedUnitId ? null : (
          <Dropdown
            label="UNIT"
            sheetTitle="Which unit?"
            value={unitId}
            onChange={setUnitId}
            placeholder="Select a unit"
            options={units.map((unit) => ({
              value: unit.id,
              label: unit.code,
              hint: unit.title,
            }))}
          />
        )}

        <Dropdown
          label="DAY"
          sheetTitle="Which day?"
          value={day}
          onChange={setDay}
          options={DAYS.map((option) => ({ value: option.index, label: option.long }))}
        />

        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <Dropdown
              label="STARTS"
              sheetTitle="Starts at"
              value={start}
              onChange={setStart}
              options={TIMES}
            />
          </View>
          <View className="flex-1">
            <Dropdown
              label="ENDS"
              sheetTitle="Ends at"
              value={end}
              onChange={setEnd}
              options={TIMES}
            />
          </View>
        </View>

        {ordered ? null : (
          <Text className="font-jk text-danger text-[12.5px]">
            The session has to end after it starts.
          </Text>
        )}

        <TextField
          label="ROOM"
          value={room}
          onChangeText={setRoom}
          placeholder="Optional"
        />

        <Button
          label="Add session"
          disabled={!canSave}
          onPress={() => {
            notify("success");
            onSave({ unitId, day, start, end, room: room.trim() });
            close();
          }}
        />
      </View>
    </Sheet>
  );
}
