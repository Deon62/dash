import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarHeight } from "@/theme/layout";

/**
 * Standard scrolling page. There is no app header any more — each page opens
 * with its own title — so the status-bar inset is applied here.
 *
 * Everything for the content container goes in `contentContainerStyle`, never
 * split across `contentContainerClassName` as well: passing both means the
 * explicit style wins and the classes are silently dropped, which is how this
 * page lost its horizontal padding.
 */
export default function Screen({ children, contentStyle }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-brand-canvas">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: getTabBarHeight(insets) + 28,
          paddingHorizontal: 20,
          rowGap: 20,
          ...contentStyle,
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
