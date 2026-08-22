import { Pressable, Text, View } from "react-native";

import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * The app's primary action.
 *
 * Always the brand blue, even when it cannot be pressed — a disabled state that
 * turns grey reads as a different control, and on a form where the button is
 * the only coloured thing on screen it looked like the page had lost its
 * accent. Unavailable is carried by opacity instead, which keeps the shape and
 * the colour and still says "not yet".
 *
 * The fill is an inline style rather than a class: this component passes a
 * style object of its own, and in that combination the object wins outright.
 */
export default function Button({
  label,
  onPress,
  disabled = false,
  busyLabel,
  busy = false,
  Icon,
  variant = "primary",
}) {
  const inactive = disabled || busy;
  const outline = variant === "outline";

  return (
    <Pressable
      onPress={() => {
        if (inactive) return;
        impact("medium");
        onPress?.();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={{
        backgroundColor: outline ? "transparent" : COLORS.primary,
        borderRadius: 16,
        borderWidth: outline ? 1 : 0,
        borderColor: COLORS.line,
        opacity: inactive ? 0.4 : 1,
      }}
      className="flex-row items-center justify-center gap-x-2 py-4 active:opacity-80"
    >
      <Text
        style={{ color: outline ? COLORS.ink : COLORS.canvas }}
        className="font-jk-med text-[15px]"
      >
        {busy ? (busyLabel ?? label) : label}
      </Text>

      {Icon && !busy ? (
        <Icon size={16} color={outline ? COLORS.ink : COLORS.canvas} strokeWidth={1.8} />
      ) : null}
    </Pressable>
  );
}

/** Same fill, pill-shaped, for inline actions rather than form submits. */
export function PillButton({ label, onPress, Icon }) {
  return (
    <Pressable
      onPress={() => {
        impact("medium");
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ backgroundColor: COLORS.primary }}
      className="flex-row items-center gap-x-2 self-center rounded-full px-5 py-3 active:opacity-85"
    >
      {Icon ? <Icon size={16} color={COLORS.canvas} strokeWidth={1.8} /> : null}
      <Text style={{ color: COLORS.canvas }} className="font-jk-med text-[14px]">
        {label}
      </Text>
    </Pressable>
  );
}

/** Spacer that keeps a button's footprint when it is conditionally hidden. */
export function ButtonRow({ children }) {
  return <View className="flex-row gap-x-2.5">{children}</View>;
}
