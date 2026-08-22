import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import ArrowButton from "@/components/ArrowButton";
import { CalendarArt, FiledArt, NotesArt } from "@/components/IntroArt";
import { useStudyStore } from "@/store/useStudyStore";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * The three pillars, in the order they happen to a student.
 *
 * One idea per screen and one sentence under it. Someone who has just
 * installed the app is deciding whether to bother, not reading documentation —
 * every extra clause is a reason to tap Skip.
 */
const SLIDES = [
  {
    key: "knowledge",
    Art: FiledArt,
    title: "Your whole course,\nfiled by unit",
    body: "Class times, notes and slides, each under the unit they belong to.",
  },
  {
    key: "study",
    Art: NotesArt,
    title: "Revise from your\nown notes",
    body: "Ask anything. Answers come straight from what you filed, quoted.",
  },
  {
    key: "calendar",
    Art: CalendarArt,
    title: "Nothing sneaks\nup on you",
    body: "CATs, exams and deadlines on one calendar, counting down.",
  },
];

/**
 * The same soft wash the sign-in screen opens with.
 *
 * Identical circles and opacities, not an approximation — these two screens
 * run back to back on a first launch, and a wash that shifts between them
 * reads as a rendering glitch rather than a transition.
 */
function Aurora() {
  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, top: 0, height: 440 }}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="i1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#007FFA" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#007FFA" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="i2" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#00C2A8" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#00C2A8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="i3" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="18%" cy="16%" r="150" fill="url(#i1)" />
        <Circle cx="88%" cy="8%" r="140" fill="url(#i2)" />
        <Circle cx="62%" cy="40%" r="130" fill="url(#i3)" />
      </Svg>
    </View>
  );
}

/** The one horizontal margin on this screen — text, bar and arrows share it. */
const PAGE_X = 28;

export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const completeIntro = useStudyStore((state) => state.completeIntro);

  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const first = index === 0;
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
    goTo(index + 1);
  };

  return (
    <View className="flex-1 bg-canvas">
      <Aurora />

      {/* --- Progress, across the top --- */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: PAGE_X }}>
        <View className="flex-row gap-x-1.5">
          {SLIDES.map((slide, step) => (
            <Pressable
              key={slide.key}
              onPress={() => {
                impact("light");
                goTo(step);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Go to screen ${step + 1}`}
              hitSlop={{ top: 12, bottom: 12 }}
              className="flex-1"
            >
              {/* Segments rather than dots: a bar that fills left to right
                  says how far through you are, where three dots only say
                  which one is lit. */}
              <View
                style={{
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: step <= index ? COLORS.primary : COLORS.line,
                }}
              />
            </Pressable>
          ))}
        </View>

        {/* Under the bar, not beside it. Sharing the row squeezed the segments
            into two thirds of the width for the sake of one small word. */}
        <View className="flex-row justify-end mt-3">
          <Pressable
            onPress={() => {
              impact("light");
              completeIntro();
            }}
            disabled={last}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
            hitSlop={10}
            style={{ opacity: last ? 0 : 1 }}
            className="active:opacity-60"
          >
            <Text className="font-jk-med text-muted text-[13.5px]">Skip</Text>
          </Pressable>
        </View>
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
            // Padding lives in the style object because one is already being
            // passed for the width: in that combination the object wins
            // outright and a `px-*` class is silently dropped, which is what
            // left the copy hard against the left edge.
            style={{ width, paddingHorizontal: PAGE_X, justifyContent: "center" }}
            className="flex-1"
          >
            {/* The art is centred; the words are not. Every panel sets its
                text against the same left edge, so nothing shifts sideways as
                the carousel pages — which is what made the copy look like it
                was changing alignment. */}
            <View
              style={{
                height: 190,
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 40,
              }}
            >
              <View style={{ width: "88%", height: "100%" }}>
                <slide.Art />
              </View>
            </View>

            <Text className="font-jk-bold text-ink text-[28px] leading-[36px]">
              {slide.title}
            </Text>
            <Text className="font-jk text-muted text-[14.5px] leading-[22px] mt-3.5">
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          paddingBottom: insets.bottom + 28,
          paddingTop: 24,
          paddingHorizontal: PAGE_X,
        }}
        className="flex-row items-center justify-between"
      >
        <ArrowButton
          direction="back"
          hidden={first}
          onPress={() => goTo(index - 1)}
          label="Previous screen"
        />

        <ArrowButton
          onPress={advance}
          label={last ? "Get started" : "Next screen"}
        />
      </View>
    </View>
  );
}
