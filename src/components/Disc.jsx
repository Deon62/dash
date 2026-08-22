import { View } from "react-native";

import { COLORS } from "@/theme/colors";

/**
 * The grey circle a glyph sits in.
 *
 * Size and radius are inline rather than utility classes on purpose. A
 * `h-14 w-14 rounded-full` container only stays round while nothing in the
 * layout above it stretches an axis — one flex parent without `items-center`
 * and the circle quietly becomes a lozenge. Fixed dimensions plus a radius of
 * exactly half cannot be stretched by a parent, so every disc in the app is
 * the same shape wherever it is dropped.
 */
export default function Disc({ size = 40, tone = "surface", children }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: tone === "none" ? "transparent" : COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}
