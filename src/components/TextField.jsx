import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

/**
 * Labelled input with an optional leading glyph. Password fields get a reveal
 * toggle — masking with no way to check what you typed is a common cause of
 * failed sign-ins on phone keyboards.
 */
export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  Icon,
  secure = false,
  ...inputProps
}) {
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text className="font-jk-bold text-brand-muted text-[10px] tracking-[1.5px] mb-2">
        {label.toUpperCase()}
      </Text>

      <View
        className={`flex-row items-center rounded-2xl border bg-white px-4 ${
          focused ? "border-brand-black" : "border-brand-hairline"
        }`}
      >
        {Icon ? (
          <Icon
            size={17}
            color={focused ? "#09090B" : "#A1A1AA"}
            strokeWidth={2}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A1A1AA"
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`flex-1 py-4 font-jk-semi text-brand-black text-[15px] ${
            Icon ? "ml-3" : ""
          }`}
          {...inputProps}
        />

        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            {hidden ? (
              <EyeOff size={17} color="#A1A1AA" strokeWidth={2} />
            ) : (
              <Eye size={17} color="#09090B" strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
