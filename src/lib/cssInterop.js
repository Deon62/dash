import Animated from "react-native-reanimated";
import { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { cssInterop } from "nativewind";

/**
 * NativeWind maps `className` to `style` automatically for core React Native
 * components only. Anything re-exported by a library — Reanimated's animated
 * wrappers, the bottom-sheet scrollers — is a different component object, so
 * `className` on them is silently dropped until registered here.
 *
 * Imported once from the root layout so registration happens before any screen
 * renders, rather than depending on which module got imported first.
 */
cssInterop(Animated.View, { className: "style" });
cssInterop(Animated.Text, { className: "style" });
cssInterop(BottomSheetView, { className: "style" });
cssInterop(BottomSheetScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
