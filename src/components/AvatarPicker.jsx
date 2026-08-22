import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, UserRound } from "lucide-react-native";

import ConfirmDialog from "@/components/ConfirmDialog";
import { COLORS } from "@/theme/colors";
import { useStudyStore } from "@/store/useStudyStore";
import { impact } from "@/lib/haptics";

const SIZE = 96;

/**
 * Tappable avatar. Falls back to initials until a picture is chosen.
 *
 * The chosen image is a local file URI held in the store. That survives a
 * restart because the store is persisted, but it is still a path into this
 * device's cache — uploading the file belongs to whatever backs accounts later.
 */
export default function AvatarPicker() {
  const profile = useStudyStore((state) => state.profile);
  const setAvatar = useStudyStore((state) => state.setAvatar);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const pick = async () => {
    if (busy) return;
    impact("light");
    setBusy(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice({
          title: "Photo access needed",
          message: "Allow photo access in settings to set a profile picture.",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        setAvatar(result.assets[0].uri);
      }
    } catch {
      setNotice({
        title: "Couldn't open photos",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={pick}
      accessibilityRole="button"
      accessibilityLabel={
        profile.avatarUri ? "Change profile picture" : "Add profile picture"
      }
      className="active:opacity-80"
    >
      <View
        style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2 }}
        className="items-center justify-center bg-primary overflow-hidden"
      >
        {profile.avatarUri ? (
          <Image
            source={{ uri: profile.avatarUri }}
            style={{ width: SIZE, height: SIZE }}
            resizeMode="cover"
          />
        ) : profile.initials ? (
          <Text className="font-jk-semi text-canvas text-[30px] tracking-[1px]">
            {profile.initials}
          </Text>
        ) : (
          // No photo and no name yet — a glyph beats two blank letters.
          <UserRound size={38} color="#FFFFFF" strokeWidth={1.8} />
        )}
      </View>

      {/* Affordance — otherwise nothing says the avatar is tappable. The badge
          is a white disc with a coloured glyph, not the reverse: a white icon
          on a coloured disc vanished into the light parts of a photo. */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: COLORS.line,
          backgroundColor: COLORS.canvas,
        }}
      >
        <Camera size={15} color={COLORS.primary} strokeWidth={2} />
      </View>

      <ConfirmDialog
        visible={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        confirmLabel="OK"
        onConfirm={() => setNotice(null)}
        onDismiss={() => setNotice(null)}
      />
    </Pressable>
  );
}
