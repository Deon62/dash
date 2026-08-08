import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarHeight } from "@/theme/layout";

/**
 * Standard scrolling page. There is no app header any more — each page opens
 * with its own title — so the status-bar inset is applied here instead.
 */
export default function Screen({ children, contentClassName = "" }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-brand-canvas">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: getTabBarHeight(insets) + 28,
        }}
        contentContainerClassName={`px-5 gap-y-5 ${contentClassName}`}
      >
        {children}
      </ScrollView>
    </View>
  );
}
