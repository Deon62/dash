import { useState } from "react";
import { Text, TextInput, View } from "react-native";

/**
 * Labelled input.
 *
 * Focus is marked with the indigo highlight — the one state on a form where a
 * colour is telling you something rather than decorating.
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
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-2">
          {label}
        </Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-2xl border bg-canvas px-4 ${
          focused ? "border-indigo" : "border-line"
        }`}
      >
        {Icon ? (
          <Icon
            size={17}
            color={focused ? "#4F46E5" : "#71717A"}
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
          style={multiline ? { minHeight: 104, textAlignVertical: "top" } : undefined}
          className={`flex-1 py-3.5 font-jk text-ink text-[15px] ${Icon ? "ml-3" : ""}`}
          {...inputProps}
        />
      </View>

      {hint ? (
        <Text className="font-jk text-muted text-[11.5px] leading-[16px] mt-2 ml-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
