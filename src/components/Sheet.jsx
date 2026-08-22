import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboard } from "@/lib/useKeyboardVisible";

/**
 * Bottom sheet.
 *
 * A plain Modal rather than the gesture-driven sheet library: everything shown
 * in one is a short list that closes on the first tap, and a draggable sheet
 * for a four-item menu is machinery the user has to learn for nothing.
 *
 * A Modal sits in its own window, so nothing outside it can lift it clear of
 * the keyboard — the sheet has to do that itself or every field inside one
 * (a link URL, a note title) types blind from behind the keys.
 */
export default function Sheet({ visible, onClose, title, subtitle, children }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        {/* Tapping outside dismisses, matching the platform convention. */}
        <Pressable
          className="absolute inset-0 bg-ink/40"
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />

        <View
          style={{
            paddingBottom: keyboard.visible
              ? keyboard.height + 12
              : Math.max(insets.bottom, 16) + 8,
          }}
          className="rounded-t-3xl bg-canvas px-5 pt-3"
        >
          <View className="h-1 w-10 self-center rounded-full bg-line" />

          {title ? (
            <View className="mt-4">
              <Text className="font-jk-semi text-ink text-[17px]">{title}</Text>
              {subtitle ? (
                <Text className="font-jk text-muted text-[13px] leading-[18px] mt-1">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Capped so a long unit list scrolls inside the sheet rather than
              pushing its own dismiss target off the screen. The cap tightens
              with the keyboard up, where there is far less room to give. */}
          <ScrollView
            style={{ maxHeight: keyboard.visible ? 300 : 420 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: title ? 16 : 12, paddingBottom: 4 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
