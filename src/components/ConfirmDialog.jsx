import { Modal, Pressable, Text, View } from "react-native";

import { impact } from "@/lib/haptics";

/**
 * In-app dialog, used instead of `Alert.alert`.
 *
 * The system alert can't be styled and looks like a different app on top of
 * this one. Omitting `onCancel` gives a single-button notice rather than a
 * confirmation.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
  onDismiss,
}) {
  const dismiss = onCancel ?? onDismiss;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View className="flex-1 items-center justify-center bg-brand-black/40 px-8">
        {/* Tapping outside dismisses, matching the platform convention. */}
        <Pressable
          className="absolute inset-0"
          onPress={dismiss}
          accessibilityLabel="Dismiss dialog"
        />

        <View
          style={{
            shadowColor: "#09090B",
            shadowOpacity: 0.2,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 12 },
            elevation: 24,
          }}
          className="w-full rounded-3xl bg-white p-6"
        >
          <Text className="font-jk-black text-brand-black text-[18px] leading-[24px]">
            {title}
          </Text>
          {message ? (
            <Text className="font-jk text-brand-slate text-[13.5px] leading-[20px] mt-2.5">
              {message}
            </Text>
          ) : null}

          <View className="flex-row gap-x-3 mt-6">
            {onCancel ? (
              <Pressable
                onPress={() => {
                  impact("light");
                  onCancel();
                }}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                className="flex-1 items-center justify-center rounded-2xl border border-brand-hairline bg-white py-3.5 active:opacity-70"
              >
                <Text className="font-jk-bold text-brand-black text-[14px]">
                  {cancelLabel}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                impact("medium");
                onConfirm?.();
              }}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              className={`flex-1 items-center justify-center rounded-2xl py-3.5 active:opacity-85 ${
                destructive ? "bg-transit-boda" : "bg-brand-black"
              }`}
            >
              <Text className="font-jk-bold text-brand-white text-[14px]">
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
