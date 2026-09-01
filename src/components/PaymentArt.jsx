import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Smartphone } from "lucide-react-native";

import { COLORS, TINTS } from "@/theme/colors";

/**
 * What fills the waiting screen while an M-Pesa prompt is out.
 *
 * Two versions, and which one you get is decided once, at module load, by
 * whether the binary actually has `expo-video` in it.
 *
 * That gate exists so this whole screen can ship as an over-the-air update.
 * `expo-video` is a native module: an OTA update can deliver the JavaScript
 * that calls it and the video file itself, but it cannot add native code to a
 * build already on a phone. A bundle that imported it unconditionally would
 * crash on launch for every student who has not been to the store — the one
 * failure that cannot be fixed from the server, on the screen where somebody is
 * trying to give us money.
 *
 * So the fallback is not a degraded experience to apologise for. It is what
 * every existing install sees until the next store build, and it has to be good
 * on its own terms: the video is nicer, and a pulsing handset says the same
 * thing.
 */

/**
 * Whether the native side is really there.
 *
 * `requireOptionalNativeModule` rather than a `try/catch` around the import,
 * because they fail differently and only one of them is catchable in the right
 * place. Importing `expo-video` evaluates its `NativeVideoModule`, which calls
 * `requireNativeModule('ExpoVideo')` and throws — at import time, before any
 * component of ours runs. Asking first, by name, is the only version of this
 * check that can answer "no" instead of exploding.
 */
const hasVideo = Boolean(requireOptionalNativeModule("ExpoVideo"));

/**
 * The module itself, loaded only where it can be used.
 *
 * `require` rather than `import` because the decision has to be made at
 * runtime — and the result is a module-level constant, so the hook count inside
 * the component below never changes between renders.
 */
// eslint-disable-next-line global-require
const video = hasVideo ? require("expo-video") : null;

/** The space this occupies, so the video and the fallback lay out identically. */
const HEIGHT = 220;

/**
 * How large the video is actually drawn.
 *
 * `payment.mp4` is **150 × 150**. That is the ceiling on how sharp this can
 * ever look, and no rendering flag changes it — `contentFit` scales to the box
 * it is given, so filling a 220dp box meant asking for 660 physical pixels from
 * a 150-pixel source on a 3× screen, and it read as blurred because it was.
 *
 * So the view is sized to the file rather than the file stretched to the view.
 * It is drawn smaller and centred in the same 220dp slot, which keeps the
 * layout identical and stops the upscale being the first thing anybody notices.
 *
 * If the source is ever re-exported larger — 600 × 600 would be sharp on every
 * phone, and there is room for it at this bitrate — raise this to match and it
 * gets better for free. It is deliberately a number and not `"100%"` so that
 * the next person has to think about the source before stretching it again.
 */
const VIDEO_SIZE = 150;

/** The looping animation, where the binary can play one. */
function VideoArt() {
  const player = video.useVideoPlayer(
    require("../../assets/payment.mp4"),
    (instance) => {
      instance.loop = true;
      // Muted, always. This runs while a student is being asked for a PIN and
      // may well be in a lecture; a payment screen that makes noise is a
      // payment screen people back out of.
      instance.muted = true;
      instance.play();
    },
  );

  return (
    <View
      style={{ height: HEIGHT, alignItems: "center", justifyContent: "center" }}
      accessible={false}
    >
      <video.VideoView
        player={player}
        // Not a video anybody scrubs. It is an animation that happens to be a
        // file, so it gets no controls and no place in the accessibility tree.
        nativeControls={false}
        contentFit="contain"
        style={{
          width: VIDEO_SIZE,
          height: VIDEO_SIZE,
          backgroundColor: COLORS.canvas,
        }}
        accessible={false}
      />
    </View>
  );
}

/**
 * A handset with a ring going out from it, for every build without the video.
 *
 * Drawn with `Animated` and two views, so it needs nothing native at all. The
 * ring expands and fades rather than spinning: a spinner means "the app is
 * working", and the app is not — it is waiting on a different device, which an
 * outgoing pulse says and a spinner does not.
 */
function PulseArt() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={{ height: HEIGHT, alignItems: "center", justifyContent: "center" }}
      accessible={false}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: TINTS.teal,
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) },
          ],
          // Gone well before the ring reaches the edge, so the loop restarting
          // is never something you can see happen.
          opacity: pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0.1, 0] }),
        }}
      />

      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: TINTS.teal,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Smartphone size={36} color={COLORS.teal} strokeWidth={1.6} />
      </View>
    </View>
  );
}

export default hasVideo ? VideoArt : PulseArt;
