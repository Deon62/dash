import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CircleAlert, CircleCheck, Lock } from "lucide-react-native";

import { uploadMaterial } from "@/lib/materials";
import { pullSync } from "@/lib/sync";
import { canPrepareScans } from "@/lib/scan";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * Where an attached file has got to, on the item it belongs to.
 *
 * It used to be one line of grey prose, and it said "Reading it now, searchable
 * shortly" for anything that was not `ready` — including the two states that
 * are never going to become ready. A student whose photo the server had already
 * rejected, with a written reason, read that sentence for ever.
 *
 * So there are now three shapes, and which one is drawn depends on whether
 * anything is still going to happen:
 *
 *  - **In flight** — a progress track through the three real stages. A file
 *    goes up, a worker reads it, and only then can the tutor quote it; a
 *    spinner says none of that, and the middle stage is the long one people
 *    were being left to guess at.
 *  - **Just finished** — a green line, briefly. The question this whole
 *    component exists to answer is "can I ask about this yet", and the moment
 *    the answer changes to yes is the moment worth saying it. It goes away on
 *    its own, because a permanent tick on every item is furniture.
 *  - **Stopped** — the server's own words for why, and the one action that can
 *    change it. Never a spinner.
 */

/**
 * The stages, in order, with how far along the track each one sits.
 *
 * Not a real byte-progress bar, and it does not pretend to be: the upload is a
 * single `fetch` with no progress events to read, and extraction happens on a
 * machine that reports nothing until it is done. What it *is* honest about is
 * which of three known steps is happening, which is the part a student is
 * actually waiting on — "reading" is the long one, and the old copy never
 * distinguished it from "uploading".
 */
const STAGES = {
  queued: { at: 0.08, label: "Waiting to upload" },
  uploading: { at: 0.3, label: "Uploading…" },
  pending: { at: 0.6, label: "Waiting to be read" },
  reading: { at: 0.82, label: "Reading your notes…" },
};

/** Copy for a stopped state with no `extractionError` from the server. */
const FALLBACK = {
  unreadable: "No text could be read from this one.",
  blocked: "Your plan does not cover reading this one.",
  failed: "Couldn't upload",
};

/** How long the "ready" confirmation stays up before the row goes quiet. */
const CONFIRM_MS = 6000;

/**
 * When "still reading" stops being a credible thing to say.
 *
 * A normal PDF is done inside ten seconds and a photo in a few, so three
 * minutes is far past anything ordinary — long enough that a slow queue or a
 * provider retry has not tripped it, short enough that nobody sits watching a
 * bar wondering whether the app has forgotten about them.
 *
 * Past it the card stops pretending to know. It does not claim a failure
 * either, because it does not have one: the server requeues on a provider
 * outage and recovers a lost worker after fifteen minutes, so "taking longer
 * than usual" is the true statement and "something went wrong" is not.
 */
const STALL_MS = 3 * 60 * 1000;

/**
 * The track, with a shimmer while something is happening.
 *
 * The fill is animated between stages rather than jumping, so the bar reads as
 * one thing making progress instead of three unrelated readings. The pulse is
 * what separates "working" from "stalled" at a glance — a static bar at 60%
 * looks identical whether a worker is reading the file or nothing is.
 */
function Track({ to }) {
  const width = useRef(new Animated.Value(to)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: to,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      // Width cannot be driven natively; the alternative is a scale transform
      // on a full-width bar, which distorts the rounded ends into ellipses.
      useNativeDriver: false,
    }).start();
  }, [to, width]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  /**
   * Two animated views, not one, and they must stay that way.
   *
   * The width and the pulse run on different drivers — width has to be on the
   * JS one because the native animated module cannot animate a layout property,
   * and the pulse is on the native one because it loops forever and has no
   * business waking the JS thread twice a second.
   *
   * Put both on a single `Animated.View` and the two drivers collide on one
   * style node: starting the native loop moves that node to native, the width
   * animation then refuses to run against it, and React Native says so twice —
   * "Style property 'width' is not supported by native animated module" and
   * "Attempting to run JS driven animation on animated node that has been moved
   * to 'native'". The bar simply stops.
   *
   * Splitting them gives each driver a node of its own: the outer view owns the
   * width, the inner one fills it and owns the opacity.
   */
  return (
    <View
      style={{ height: 4, borderRadius: 2, backgroundColor: COLORS.surface }}
      className="mt-2"
    >
      <Animated.View
        style={{
          height: 4,
          borderRadius: 2,
          overflow: "hidden",
          width: width.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: COLORS.primary,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
          }}
        />
      </Animated.View>
    </View>
  );
}

/** A text action, sized to sit inside a list row rather than on top of it. */
function Action({ label, onPress, tone = "primary" }) {
  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-60"
    >
      <Text
        className={`font-jk-med text-[12.5px] ${
          tone === "muted" ? "text-muted" : "text-primary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function UploadStatus({ material, onReplace, scanningAllowed = true }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const status = material.uploadStatus;

  /**
   * Whether this item became ready while somebody was looking at it.
   *
   * Held here rather than on the row because it is about this screen, not about
   * the material: a card that has been ready since last week has nothing to
   * announce, and persisting the flag would announce it again on every launch.
   */
  const [justReady, setJustReady] = useState(false);
  const previous = useRef(status);

  useEffect(() => {
    const was = previous.current;
    previous.current = status;

    if (status !== "ready" || was === "ready" || was === undefined) return;

    setJustReady(true);
    const timer = setTimeout(() => setJustReady(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // A typed note, or a file whose text has been searchable for a while.
  if (!status || (status === "ready" && !justReady)) return null;

  if (status === "ready") {
    const pages = material.pageCount;

    return (
      <View className="flex-row items-center mt-2">
        <CircleCheck size={13} color={COLORS.teal} strokeWidth={2} />
        <Text className="font-jk-med text-[12.5px] ml-1.5" style={{ color: COLORS.teal }}>
          {/* Says what changed, not that a job finished. "Read" is a status;
              "the tutor can quote it" is the thing the student was waiting
              for. */}
          Ready — the tutor can quote this
          {pages ? ` (${pages} ${pages === 1 ? "page" : "pages"})` : ""}
        </Text>
      </View>
    );
  }

  // The bytes never left this phone. The same file can simply go again.
  if (status === "failed" && material.uri) {
    const retry = async () => {
      if (retrying) return;
      setRetrying(true);
      await uploadMaterial(material);
      // No state to clear on success — the row re-renders from the material's
      // own status, which the upload has already moved on.
      setRetrying(false);
    };

    return (
      <View className="flex-row items-center mt-2">
        <CircleAlert size={13} color={COLORS.danger} strokeWidth={2} />

        <Text className="font-jk-med text-ink text-[12.5px] ml-1.5">
          {retrying ? "Trying again…" : "Couldn't upload"}
        </Text>

        {retrying ? null : (
          <>
            {/* A dot, not a gap: at this size two words separated by space
                read as one phrase, and "Retry" has to look pressable. */}
            <Text className="font-jk text-faint text-[12.5px] mx-1.5">·</Text>
            <Action label="Retry" onPress={() => retry()} />
          </>
        )}
      </View>
    );
  }

  /**
   * Read, and rejected. Terminal — the same bytes will never succeed.
   *
   * So the action is another file, never a retry of this one. The server's
   * message names the fix ("Most Compatible saves photos as JPEG", "make sure
   * the page fills the frame"), which is why it is printed word for word.
   */
  if (status === "unreadable") {
    return (
      <View className="flex-row items-start mt-2">
        <View className="mt-[2px]">
          <CircleAlert size={13} color={COLORS.amber} strokeWidth={2} />
        </View>

        <View className="flex-1 ml-1.5">
          <Text className="font-jk text-ink text-[12.5px] leading-[17px]">
            {material.extractionError || FALLBACK.unreadable}
          </Text>

          {onReplace ? (
            <View className="mt-1.5">
              <Action
                label={
                  material.kind !== "image"
                    ? "Choose another file"
                    : canPrepareScans
                      ? "Take another photo"
                      : "Choose another photo"
                }
                onPress={() => onReplace(material)}
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  /**
   * Nothing wrong with the file — the plan does not cover it. Also terminal,
   * and re-uploading is a loop that cannot succeed, so there is no retry here
   * at any price.
   *
   * Two different refusals arrive under this one status: the feature is not on
   * this plan, or this month's pages are spent. They need opposite answers, and
   * the tier tells them apart — a student already on a scanning plan cannot buy
   * their way out of having used the allowance, so sending them to the paywall
   * would sell them what they have.
   */
  if (status === "blocked") {
    return (
      <View className="flex-row items-start mt-2">
        <View className="mt-[2px]">
          <Lock size={13} color={COLORS.muted} strokeWidth={2} />
        </View>

        <View className="flex-1 ml-1.5">
          <Text className="font-jk text-ink text-[12.5px] leading-[17px]">
            {material.extractionError || FALLBACK.blocked}
          </Text>

          <View className="mt-1.5">
            {scanningAllowed ? (
              <Action label="See your usage" onPress={() => router.push("/usage")} />
            ) : (
              <Action label="See plans" onPress={() => router.push("/billing")} />
            )}
          </View>
        </View>
      </View>
    );
  }

  const stage = STAGES[status] ?? STAGES.pending;

  const waiting = status === "pending" || status === "reading";
  const since = material.waitingSince ? Date.parse(material.waitingSince) : null;
  const stalled = waiting && since && Date.now() - since > STALL_MS;

  /**
   * Past the point where a progress bar is honest.
   *
   * The bar goes, because a bar that has been at 82% for ten minutes is a
   * claim the app cannot support, and it is the exact thing that made students
   * ask whether anything was happening at all. What replaces it says the true
   * thing — nobody here knows — and offers the one action that can find out.
   */
  if (stalled) {
    return (
      <View className="flex-row items-start mt-2">
        <View className="mt-[2px]">
          <CircleAlert size={13} color={COLORS.muted} strokeWidth={2} />
        </View>

        <View className="flex-1 ml-1.5">
          <Text className="font-jk text-muted text-[12.5px] leading-[17px]">
            This is taking longer than usual. It is still queued — nothing has
            been lost, and it will finish on its own.
          </Text>
          <View className="mt-1.5">
            <Action label="Check again" onPress={() => pullSync()} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mt-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-jk text-muted text-[12.5px]">{stage.label}</Text>
        {/* Said once, under the bar, rather than on every stage: it is the
            reassurance ("you can leave"), and repeating it at each step turns
            reassurance into nagging. */}
        {waiting ? (
          <Text className="font-jk text-faint text-[11.5px]">
            You can close the app
          </Text>
        ) : null}
      </View>

      <Track to={stage.at} />
    </View>
  );
}
