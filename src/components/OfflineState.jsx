import { Text, useWindowDimensions, View } from "react-native";

import OfflineArt from "../../assets/offline.svg";
import { PillButton } from "@/components/Button";
import { RotateCcw } from "lucide-react-native";

/**
 * What a screen shows when the network is the thing missing.
 *
 * Most of this app does not need one. The device is a cache and an outbox, so
 * notes, units, the timetable and the deck all work with the radio off, and
 * putting "you are offline" over content that is right there would be a lie
 * told in a large font. This is for the handful of places where the server
 * genuinely is the answer — asking the tutor, reading the meters, buying a
 * plan — and it says so in those words rather than in an error code.
 *
 * The illustration earns its place by being the fastest way to read the
 * situation. Someone glancing at their phone on a bus recognises the picture
 * before the sentence, which is exactly the moment this appears.
 *
 * It is sized against the window rather than given a fixed height: on a small
 * handset a 240pt drawing plus a heading plus a button does not fit above the
 * fold, and an offline screen that has to be scrolled to find the retry button
 * is worse than no picture at all.
 */
export default function OfflineState({
  title = "You're offline",
  message = "This one needs a connection. Everything you've already filed is still here and still works.",
  onRetry,
  retryLabel = "Try again",
  compact = false,
}) {
  const { width, height } = useWindowDimensions();

  // The drawing is 583×383 — a hair over 3:2. Kept to a share of the shorter
  // dimension so it stays whole in landscape and on a split screen.
  const artWidth = Math.min(width * (compact ? 0.5 : 0.66), height * 0.34 * 1.52, 300);

  return (
    <View className={`items-center px-6 ${compact ? "py-6" : "py-10"}`}>
      <OfflineArt width={artWidth} height={artWidth / 1.52} />

      <Text className="font-jk-semi text-ink text-[16px] text-center mt-7">
        {title}
      </Text>
      <Text className="font-jk text-muted text-[13px] leading-[19px] text-center mt-2">
        {message}
      </Text>

      {onRetry ? (
        <View className="mt-6">
          <PillButton label={retryLabel} Icon={RotateCcw} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
