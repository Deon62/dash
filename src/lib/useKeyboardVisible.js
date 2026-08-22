import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * The software keyboard's state and height.
 *
 * Measured rather than left to `KeyboardAvoidingView`, which cannot be relied
 * on here: with edge-to-edge enabled the Android window is not resized for the
 * keyboard, so the view never learns the keyboard exists and the field it is
 * meant to lift stays underneath it. The height comes straight from the event,
 * which is correct on both platforms.
 *
 * iOS gets the `Will` events so the UI moves with the keyboard's animation
 * rather than snapping after it; Android only fires the `Did` pair.
 */
export function useKeyboard() {
  const [state, setState] = useState({ visible: false, height: 0 });

  useEffect(() => {
    const shown = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) =>
        setState({ visible: true, height: event.endCoordinates?.height ?? 0 })
    );
    const hidden = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setState({ visible: false, height: 0 })
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return state;
}

/** Just the flag, for callers that only need to get out of the way. */
export function useKeyboardVisible() {
  return useKeyboard().visible;
}
