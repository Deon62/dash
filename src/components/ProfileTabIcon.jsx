import { Image, View } from "react-native";
import { CircleUser } from "lucide-react-native";

import { useStudyStore } from "@/store/useStudyStore";

/**
 * Profile tab icon. Shows the user's picture once one is set, falling back to
 * the outline glyph. Takes the same props BottomTabBar passes any Lucide icon,
 * so it drops into the `Icon` option unchanged.
 */
export default function ProfileTabIcon({ size = 23, color, strokeWidth }) {
  const avatarUri = useStudyStore((state) => state.profile.avatarUri);

  if (!avatarUri) {
    // No photo yet — the outline glyph, same as a fresh account elsewhere.
    return <CircleUser size={size} color={color} strokeWidth={strokeWidth} />;
  }

  // The ring keeps the photo reading as an icon and marks the focused state,
  // which colour alone can't do once the glyph is replaced by an image.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
      }}
      className="overflow-hidden"
    >
      <Image
        source={{ uri: avatarUri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
    </View>
  );
}
