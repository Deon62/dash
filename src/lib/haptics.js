import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const STYLES = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

/**
 * Fire-and-forget haptic tap. No-ops on web (where the module is unavailable)
 * and swallows failures on devices without a taptic engine.
 */
export function impact(style = "light") {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(STYLES[style] ?? STYLES.light).catch(() => {});
}

export function notify(type = "success") {
  if (Platform.OS === "web") return;
  const map = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  };
  Haptics.notificationAsync(map[type] ?? map.success).catch(() => {});
}
