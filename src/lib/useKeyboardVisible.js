import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Whether the software keyboard is on screen.
 *
 * iOS gets the `Will` events so the UI moves with the keyboard's animation
 * rather than snapping after it; Android only fires the `Did` pair.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setVisible(true)
    );
    const hidden = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setVisible(false)
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return visible;
}
