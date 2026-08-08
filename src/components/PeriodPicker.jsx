import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown } from "lucide-react-native";

import { PERIODS, getPeriod } from "@/theme/periods";
import { impact } from "@/lib/haptics";

/**
 * Compact reporting-window control.
 *
 * A row of preset rows behind a chip rather than a segmented control: five
 * windows will not fit across a phone without truncating, and the chip keeps
 * the filter to one small element above everything it scopes.
 */
export default function PeriodPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const active = getPeriod(value);

  const select = (key) => {
    impact("light");
    onChange(key);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          impact("light");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Change period, currently ${active.short}`}
        hitSlop={6}
        className="flex-row items-center gap-x-1.5 rounded-full border border-brand-hairline bg-white px-3 py-2 active:opacity-70"
      >
        <Text className="font-jk-bold text-brand-black text-[12px]">
          {active.short}
        </Text>
        <ChevronDown size={14} color="#52525B" strokeWidth={2.3} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-brand-black/20"
          onPress={() => setOpen(false)}
          accessibilityLabel="Dismiss period menu"
        >
          <View
            style={{
              marginTop: insets.top + 62,
              shadowColor: "#09090B",
              shadowOpacity: 0.16,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: 18,
            }}
            className="self-end mr-5 w-56 rounded-2xl bg-white overflow-hidden"
          >
            {PERIODS.map((period) => {
              const selected = period.key === value;

              return (
                <Pressable
                  key={period.key}
                  onPress={() => select(period.key)}
                  accessibilityRole="button"
                  accessibilityLabel={period.heading}
                  accessibilityState={selected ? { selected: true } : {}}
                  className="flex-row items-center px-4 py-3.5 active:bg-brand-black/[0.04]"
                >
                  <Text
                    className={`flex-1 text-[14px] ${
                      selected
                        ? "font-jk-bold text-brand-black"
                        : "font-jk-semi text-brand-slate"
                    }`}
                  >
                    {period.heading}
                  </Text>
                  {selected ? (
                    <Check size={16} color="#09090B" strokeWidth={2.6} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
