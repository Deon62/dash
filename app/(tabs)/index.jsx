import { useMemo, useRef } from "react";
import { View } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MapCanvas from "@/components/MapCanvas";
import TripSheet from "@/components/TripSheet";
import {
  SHEET_HANDLE_HEIGHT,
  SHEET_PEEK_HEIGHT,
  getTabBarHeight,
} from "@/theme/layout";

export default function TripsScreen() {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();

  const tabBarHeight = getTabBarHeight(insets);

  // Collapsed height = handle + peek card + room for the bottom bar, so the
  // status card lands fully above the bar and nothing else shows.
  const snapPoints = useMemo(
    () => [SHEET_HANDLE_HEIGHT + SHEET_PEEK_HEIGHT + tabBarHeight, "62%", "92%"],
    [tabBarHeight]
  );

  return (
    <View className="flex-1 bg-brand-canvas">
      <MapCanvas />

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        // The map is near-white, so a white sheet on top has no natural edge.
        // A hard top hairline plus a deep shadow is what makes the card's start
        // readable — the shadow alone disappears against light tiles.
        backgroundStyle={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: "#E2E2E7",
        }}
        handleIndicatorStyle={{
          backgroundColor: "#C4C4CC",
          width: 48,
          height: 5,
        }}
        style={{
          shadowColor: "#09090B",
          shadowOpacity: 0.22,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -8 },
          elevation: 24,
        }}
      >
        <TripSheet bottomPadding={tabBarHeight} />
      </BottomSheet>
    </View>
  );
}
