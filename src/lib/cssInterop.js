import Animated from "react-native-reanimated";
import { cssInterop } from "nativewind";

/**
 * NativeWind maps `className` to `style` automatically for core React Native
 * components only. Anything re-exported by a library — Reanimated's animated
 * wrappers, for instance — is a different component object, so `className` on
 * one is silently dropped until it is registered here.
 *
 * Imported once from the root layout so registration happens before any screen
 * renders, rather than depending on which module got imported first.
 */
cssInterop(Animated.View, { className: "style" });
cssInterop(Animated.Text, { className: "style" });
