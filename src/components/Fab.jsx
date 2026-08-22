import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";

import { getTabBarHeight } from "@/theme/layout";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

const SIZE = 56;

/**
 * The compose button: a filled disc pinned above the tab bar, bottom right.
 *
 * Sits over the content rather than in the header because adding is the thing
 * a student does most on the Knowledge tab, and the bottom right corner is the
 * only part of a phone screen a thumb reaches without moving the hand.
 */
export default function Fab({ onPress, label = "Add", Icon = Plus }) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={() => {
        impact("medium");
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        bottom: getTabBarHeight(insets) + 16,
        // The fill is set here, not through a class. This is the one component
        // that passes a full inline style alongside `className`, and in that
        // combination the inline object wins — a `bg-*` class on it silently
        // did nothing and the disc rendered transparent.
        backgroundColor: COLORS.primary,
        // A ring of shadow is what separates the disc from whatever scrolls
        // under it; a flat circle on white reads as part of the page.
        shadowColor: "#09090B",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      }}
      className="absolute right-5 items-center justify-center active:opacity-85"
    >
      <Icon size={24} color="#FFFFFF" strokeWidth={1.8} />
    </Pressable>
  );
}
