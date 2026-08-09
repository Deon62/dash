import { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";

import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

const SIZE = 96;

/**
 * Tappable avatar. Falls back to initials until a picture is chosen.
 *
 * The chosen image is a local file URI held in the store, so it survives
 * navigation but not a restart — persisting it needs real storage, which is a
 * job for whatever backs accounts later.
 */
export default function AvatarPicker() {
  const profile = useTransitStore((state) => state.profile);
  const setAvatar = useTransitStore((state) => state.setAvatar);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    if (busy) return;
    impact("light");
    setBusy(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo access to set a profile picture."
        );
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
      Alert.alert("Couldn't open photos", "Please try again.");
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
        className="items-center justify-center bg-brand-black overflow-hidden"
      >
        {profile.avatarUri ? (
          <Image
            source={{ uri: profile.avatarUri }}
            style={{ width: SIZE, height: SIZE }}
            resizeMode="cover"
          />
        ) : (
          <Text className="font-jk-black text-brand-white text-[30px] tracking-[1px]">
            {profile.initials}
          </Text>
        )}
      </View>

      {/* Affordance — otherwise nothing says the avatar is tappable. */}
      <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-black">
        <Camera size={14} color="#FFFFFF" strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}
