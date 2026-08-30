import { Pressable, Text, View } from "react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";
import { CHROME_SCALE } from "@/theme/type";

/**
 * Two or three choices, all visible, one selected.
 *
 * A segmented control rather than a switch or a dropdown, because both of the
 * options are the thing being chosen between and both have to be readable
 * without touching anything. A toggle labelled "Season" makes the student work
 * out what the other position means; a dropdown hides the choice behind a tap.
 *
 * The selected segment is a white tile on the grey track — raised, the way the
 * platform draws this — so the state is legible without colour. Colour is
 * carried by the label alone, and by a badge where one option has a reason
 * attached to it.
 */
export default function Segmented({ options, value, onChange }) {
  return (
    <View
      style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 4 }}
      className="flex-row"
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              impact("light");
              onChange?.(option.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={
              option.badge ? `${option.label}, ${option.badge}` : option.label
            }
            accessibilityState={{ selected }}
            style={{
              backgroundColor: selected ? COLORS.canvas : "transparent",
              borderRadius: 12,
              // The tile keeps its footprint unselected, so nothing shifts
              // sideways as the selection moves.
              paddingVertical: 10,
              shadowColor: "#09090B",
              shadowOpacity: selected ? 0.06 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: selected ? 2 : 0,
            }}
            className="flex-1 flex-row items-center justify-center gap-x-2 active:opacity-70"
          >
            <Text
              maxFontSizeMultiplier={CHROME_SCALE}
              style={{ color: selected ? COLORS.ink : COLORS.muted }}
              className="font-jk-med text-[14px]"
            >
              {option.label}
            </Text>

            {/* A reason to tap, not a spec. It stays on the unselected side
                too — that is the side it is arguing for. */}
            {option.badge ? (
              <View
                style={{ backgroundColor: COLORS.primary, borderRadius: 999 }}
                className="px-2 py-0.5"
              >
                <Text
                  maxFontSizeMultiplier={CHROME_SCALE}
                  style={{ color: COLORS.canvas }}
                  className="font-jk-med text-[10.5px]"
                >
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
