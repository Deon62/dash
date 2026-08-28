import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * The words shown while the tutor is composing an answer.
 *
 * A wait with a changing label reads as work happening; the same sentence held
 * for eight seconds reads as a hang. They are deliberately a little silly —
 * this is the one moment in the app where nothing is being asked of the
 * student, so it is the one place a bit of character costs nothing.
 *
 * Two of them name what the tutor is actually doing, which keeps the set from
 * feeling purely decorative. Add to the list freely; nothing depends on its
 * length or order.
 */
export const THINKING_WORDS = [
  "Pondering…",
  "Rummaging…",
  "Percolating…",
  "Noodling…",
  "Untangling…",
  "Ruminating…",
  "Marinating…",
  "Puzzling…",
  "Cogitating…",
  "Connecting dots…",
  "Flipping pages…",
  "Skimming your notes…",
];

const HOLD_MS = 2200;
const FADE_MS = 240;

/**
 * A copy of the list in random order.
 *
 * Shuffling beats picking at random on each tick: a random pick can land on
 * the word already showing, or repeat one three times before another appears.
 * Walking a shuffled list guarantees a different word every time and the whole
 * set before any repeat, so a student who waits often still sees variety.
 */
function shuffled(words) {
  const copy = [...words];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The current word, changing on a timer. Split out from the label so a wait
 * rendered some other way — a heading, a button — can use the same rotation
 * without a `<Text>` wrapper it does not want.
 */
export function useThinkingWord(holdMs = HOLD_MS) {
  // Once per mount, and the component mounts fresh for each question, so two
  // consecutive questions do not open on the same word.
  const order = useMemo(() => shuffled(THINKING_WORDS), []);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((current) => current + 1), holdMs);
    return () => clearInterval(id);
  }, [holdMs]);

  return order[index % order.length];
}

/**
 * Drawn in the streak orange, on whatever is behind it.
 *
 * No bubble: a grey panel makes the wait look like a message that has already
 * arrived, and the reader waits for text to appear inside it. Loose on the
 * ground it reads as the app talking rather than the tutor answering. Orange
 * because it is the one warm colour in the palette and nothing else on these
 * screens uses it, so the eye finds it without it having to be large.
 */
export default function ThinkingLabel({
  className = "font-jk-med text-flame text-[13.5px]",
}) {
  const word = useThinkingWord();
  const opacity = useSharedValue(1);

  // Someone who has asked the system to reduce motion still gets the changing
  // words — they report progress — but not the fade.
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    // Snap to invisible and fade the new word up. Fading the old one out first
    // would need the swap to happen inside an animation callback, and the
    // in-only version is indistinguishable at this size.
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: FADE_MS });
  }, [word, opacity, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={style}>
      <Text className={className}>{word}</Text>
    </Animated.View>
  );
}
