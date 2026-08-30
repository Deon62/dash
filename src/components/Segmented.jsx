import { Pressable, Text, View } from "react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";
import { CHROME_SCALE } from "@/theme/type";

/**
 * Two choices, both readable, one selected.
 *
 * A segmented control rather than a switch or a dropdown, because both options
 * are the thing being chosen between and both have to be readable without
 * touching anything. A toggle labelled "Season" makes the student work out
 * what the other position means; a dropdown hides the choice behind a tap.
 *
 * Fixed width, centred, halves of exactly equal size. Sizing each segment to
 * its own label made the one with something extra to say — "−21%" — half again
 * as wide as the other, which reads as the app pushing the dearer option
 * before a word of it is read. Equal halves say the two are alternatives.
 *
 * No colour anywhere in it. Blue means "this is the action" everywhere else in
 * the app, and a blue chip here was competing with the buttons on the three
 * cards below for the same meaning. The selection is carried by a white tile
 * on a grey track — raised, the way the platform draws this — which is legible
 * without relying on colour at all.
 */
const TRACK_WIDTH = 276;

export default function Segmented({ options, value, onChange }) {
  return (
    <View
      style={{
        width: TRACK_WIDTH,
        backgroundColor: COLORS.surface,
        borderRadius: 999,
        padding: 5,
      }}
      className="flex-row self-center"
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
              borderRadius: 999,
              // Tall enough to be a comfortable target and to give the pill
              // some presence above three tall cards. The tile keeps its
              // footprint unselected, so nothing shifts as the selection moves.
              paddingVertical: 13,
              shadowColor: "#09090B",
              shadowOpacity: selected ? 0.06 : 0,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: selected ? 2 : 0,
            }}
            className="flex-1 flex-row items-center justify-center gap-x-1.5 active:opacity-70"
          >
            <Text
              maxFontSizeMultiplier={CHROME_SCALE}
              style={{ color: selected ? COLORS.ink : COLORS.muted }}
              className="font-jk-med text-[13.5px]"
            >
              {option.label}
            </Text>

            {/* The saving, set as quiet type beside the word rather than as a
                chip: it is a footnote to the label, and a badge with a fill
                behind it turns a two-word control into an advertisement. It
                stays on the unselected side too — that is the side it is
                arguing for. */}
            {option.badge ? (
              <Text
                maxFontSizeMultiplier={CHROME_SCALE}
                style={{ color: selected ? COLORS.muted : COLORS.faint }}
                className="font-jk-med text-[11.5px]"
              >
                {option.badge}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
