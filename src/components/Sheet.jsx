import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom sheet.
 *
 * A plain Modal rather than the gesture-driven sheet library: everything shown
 * in one is a short list that closes on the first tap, and a draggable sheet
 * for a four-item menu is machinery the user has to learn for nothing.
 */
export default function Sheet({ visible, onClose, title, subtitle, children }) {
  const insets = useSafeAreaInsets();

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
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
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
              pushing its own dismiss target off the screen. */}
          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: title ? 16 : 12, paddingBottom: 4 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
