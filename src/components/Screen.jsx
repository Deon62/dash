import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarHeight } from "@/theme/layout";

/**
 * Standard scrolling page.
 *
 * The status-bar inset sits on the *container*, not the scroll content: with it
 * inside the content it scrolls away, so anything scrolled up — which is what
 * happens when the keyboard opens — passes under the camera cutout.
 *
 * Everything for the content container goes in `contentContainerStyle`, never
 * split across `contentContainerClassName` as well: passing both means the
 * explicit style wins and the classes are silently dropped.
 */
export default function Screen({
  children,
  contentStyle,
  keyboardAware = false,
  bare = false,
}) {
  const insets = useSafeAreaInsets();

  const scroller = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        paddingTop: 12,
        // `bare` pages are pushed as a stack screen, so there is no tab bar
        // underneath them to clear.
        paddingBottom: (bare ? Math.max(insets.bottom, 16) : getTabBarHeight(insets)) + 28,
        paddingHorizontal: 20,
        rowGap: 22,
        ...contentStyle,
      }}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-canvas">
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
          className="flex-1"
        >
          {scroller}
        </KeyboardAvoidingView>
      ) : (
        scroller
      )}
    </View>
  );
}
