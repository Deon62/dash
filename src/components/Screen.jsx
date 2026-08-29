import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabBarHeight } from "@/theme/layout";
import { COLORS } from "@/theme/colors";
import OfflineGate from "@/components/OfflineGate";

/** Disc height plus its offset, rounded up. */
const FAB_CLEARANCE = 92;

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
  fab = false,
  onRefresh,
  /**
   * The route's own name, so `NETWORK_OPTIONAL` in `OfflineGate` can let this
   * page through. Optional — an unnamed screen is simply always gated.
   */
  name,
}) {
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);

  /**
   * Pull to refresh, where a page opts in.
   *
   * Worth having on almost every list in this app, because of how it is built:
   * the device is a cache and an outbox, and sync runs on focus, on app-state
   * change and on a debounce after writes — all of it invisible. When a student
   * suspects something is stale, the gesture they make is a pull-down. Without
   * one, nothing happens and the page reads as frozen rather than as not
   * offering the gesture. It is also the only manual retry for a failed sync;
   * before this the only recourse was to wait for the next automatic attempt.
   *
   * The spinner is held for the whole call and never throws out of here: every
   * sync path resolves rather than rejecting, but a rejection would otherwise
   * leave a spinner turning over a page that had already given up.
   */
  const refresh = useCallback(async () => {
    if (!onRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // Whatever went wrong has already been recorded by the thing that failed.
      // This only owns the spinner.
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const scroller = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            // Android draws its own circle and takes a single colour; iOS takes
            // the tint. Both named so the gesture belongs to this app rather
            // than arriving in the platform's default grey.
            colors={[COLORS.primary]}
            tintColor={COLORS.muted}
            progressBackgroundColor={COLORS.canvas}
          />
        ) : undefined
      }
      contentContainerStyle={{
        paddingTop: 12,
        // `bare` pages are pushed as a stack screen, so there is no tab bar
        // underneath them to clear.
        // A floating button covers the bottom-right corner of the list, so
        // pages carrying one need the last row pushed clear of it.
        paddingBottom:
          (bare ? Math.max(insets.bottom, 16) : getTabBarHeight(insets)) +
          (fab ? FAB_CLEARANCE : 28),
        paddingHorizontal: 20,
        rowGap: 22,
        ...contentStyle,
      }}
    >
      {children}
    </ScrollView>
  );

  const body = (
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

  /**
   * Gated here rather than at each call site.
   *
   * Nearly every page in the app is a `Screen`, so this is the one place that
   * covers them all at once — and the one place to look when asking why a page
   * is showing the offline drawing. The tab bar is drawn by the tabs navigator
   * *outside* this component, which is why it stays put underneath: the gate
   * replaces the page, not the chrome around it.
   *
   * `app/(tabs)/study.jsx` builds its own layout and does not come through
   * here, so it gates itself.
   */
  return (
    <OfflineGate bare={bare} name={name}>
      {body}
    </OfflineGate>
  );
}
