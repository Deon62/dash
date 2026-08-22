import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { COLORS } from "@/theme/colors";

/**
 * Labelled input.
 *
 * A rule under the field rather than a box around it. The rest of the app
 * separates things with hairlines — the unit list, the settings rows, the
 * timetable — and a form of outlined rectangles in the middle of that reads as
 * a different app. The line is also what makes focus legible: it is the only
 * thing on the row that changes colour, so the eye goes straight to it.
 */
export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  Icon,
  hint,
  multiline = false,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? (
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
          {label}
        </Text>
      ) : null}

      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: focused ? COLORS.primary : COLORS.line,
        }}
        className="flex-row items-center"
      >
        {Icon ? (
          <Icon
            size={17}
            color={focused ? COLORS.primary : COLORS.muted}
            strokeWidth={1.8}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A1A1AA"
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={multiline ? { minHeight: 96, textAlignVertical: "top" } : undefined}
          className={`flex-1 py-3 font-jk text-ink text-[15.5px] ${Icon ? "ml-3" : ""}`}
          {...inputProps}
        />
      </View>

      {hint ? (
        <Text className="font-jk text-muted text-[11.5px] leading-[16px] mt-2">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
