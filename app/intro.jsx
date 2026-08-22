import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, FolderClosed, Orbit } from "lucide-react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import Button from "@/components/Button";
import { useStudyStore } from "@/store/useStudyStore";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * The three pillars, in the order they happen to a student.
 *
 * One idea per screen and no feature lists: someone who has just installed the
 * app is deciding whether to bother, not learning where the buttons are. Each
 * line says what they get, not what the app has.
 */
const SLIDES = [
  {
    key: "knowledge",
    Icon: FolderClosed,
    title: "Your whole course,\nfiled by unit",
    body: "Class times, lecture notes, slides, past papers — everything for CS201 sits under CS201, instead of scattered across a gallery, a chat and three notebooks.",
  },
  {
    key: "study",
    Icon: Orbit,
    title: "Revise from your\nown notes",
    body: "Ask anything and the answer comes out of the material you filed, quoted back with the note it came from. Nothing invented, nothing off-syllabus — because you are marked on your lecturer's words, not the internet's.",
  },
  {
    key: "calendar",
    Icon: CalendarDays,
    title: "Nothing sneaks\nup on you",
    body: "CATs, exams, assignments and projects on one calendar, colour-coded and counting down. You see the week that is about to get heavy while there is still time to do something about it.",
  },
];

/** The same soft wash the sign-in screen opens with, so the two feel related. */
function Aurora() {
  return (
    <View className="absolute inset-x-0 top-0 h-96" pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="i1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#007FFA" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#007FFA" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="i2" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#00C2A8" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#00C2A8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="20%" cy="18%" r="160" fill="url(#i1)" />
        <Circle cx="86%" cy="10%" r="150" fill="url(#i2)" />
      </Svg>
    </View>
  );
}

export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const completeIntro = useStudyStore((state) => state.completeIntro);

  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;

  const goTo = (next) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const advance = () => {
    if (last) {
      // No navigation — the session guard sends them on to sign-in once the
      // flag flips.
      completeIntro();
      return;
    }
    impact("light");
    goTo(index + 1);
  };

  return (
    <View className="flex-1 bg-canvas">
      <Aurora />

      {/* Kept quiet, but present until the last screen — making someone sit
          through three panels to reach a sign-in button loses people. The row
          keeps its height when the control goes, so nothing shifts. */}
      <View
        style={{ paddingTop: insets.top + 8, height: insets.top + 48 }}
        className="items-end px-5"
      >
        {last ? null : (
          <Pressable
            onPress={() => {
              impact("light");
              completeIntro();
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
            hitSlop={10}
            className="px-2 py-2 active:opacity-60"
          >
            <Text className="font-jk-med text-muted text-[13.5px]">Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.key}
            style={{ width }}
            className="flex-1 items-center justify-center px-9"
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.surface,
              }}
            >
              <slide.Icon size={34} color={COLORS.primary} strokeWidth={1.5} />
            </View>

            <Text className="font-jk-bold text-ink text-[28px] leading-[36px] text-center mt-8">
              {slide.title}
            </Text>
            <Text className="font-jk text-muted text-[14px] leading-[22px] text-center mt-4">
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 24 }}
        className="px-6 pt-4"
      >
        <View className="flex-row justify-center gap-x-2 mb-7">
          {SLIDES.map((slide, dot) => (
            <Pressable
              key={slide.key}
              onPress={() => {
                impact("light");
                goTo(dot);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Go to screen ${dot + 1}`}
              hitSlop={8}
            >
              {/* The current dot stretches rather than just darkening — it
                  reads as a position on a track, not a disabled button. */}
              <View
                style={{
                  width: dot === index ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: dot === index ? COLORS.primary : COLORS.line,
                }}
              />
            </Pressable>
          ))}
        </View>

        <Button label={last ? "Get started" : "Next"} onPress={advance} />
      </View>
    </View>
  );
}
