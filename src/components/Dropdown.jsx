import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";

import Sheet from "@/components/Sheet";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * Labelled select.
 *
 * Options open in a sheet rather than sitting on the page as a row of chips:
 * six years and two semesters laid out as tappable tiles turn a two-line form
 * into a screenful, and a closed field states the current value in one line.
 *
 * Closed, it is a rule with a value on it — the same shape as the text fields
 * it sits beside, so a form reads as one set of lines rather than a stack of
 * unrelated controls.
 */
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
  sheetTitle,
}) {
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  return (
    <View>
      {label ? (
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          impact("light");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? "Select"}: ${selected?.label ?? placeholder}`}
        style={{ borderBottomWidth: 1, borderBottomColor: COLORS.line }}
        className="flex-row items-center py-3 active:opacity-60"
      >
        <Text
          className={`flex-1 text-[15.5px] ${
            selected ? "font-jk text-ink" : "font-jk text-muted"
          }`}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={17} color="#71717A" strokeWidth={1.8} />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label}
      >
        {options.map((option) => {
          const active = option.value === value;

          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                impact("light");
                onChange(option.value);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              className="flex-row items-center py-3.5 active:opacity-60"
            >
              <View className="flex-1 pr-3">
                <Text
                  className={`text-[15px] ${
                    active ? "font-jk-semi text-ink" : "font-jk text-ink"
                  }`}
                >
                  {option.label}
                </Text>
                {option.hint ? (
                  <Text className="font-jk text-muted text-[12px] mt-0.5">
                    {option.hint}
                  </Text>
                ) : null}
              </View>

              {active ? <Check size={17} color="#007FFA" strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}
