import { Component, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

import { reportCrash } from "@/lib/analytics";
import { COLORS } from "@/theme/colors";
import { STORE_KEY } from "@/store/useStudyStore";

/**
 * The last thing between a bug and a blank screen.
 *
 * A React error unmounts the whole tree. Without something to catch it the
 * student is left on white, with no header, no tabs and no way back except
 * force-quitting — and if what threw is reached during rehydration, force-quit
 * lands them on the same white screen again. That is an install nobody can
 * recover from without clearing app data, which takes their unsynced work with
 * it. Crash *reporting* is already wired up and does not help here: PostHog
 * gets a beautiful stack trace and the student still cannot use the app.
 *
 * So this catches, reports the same way, and offers the two ways out in the
 * order they should be tried.
 */

/** Counts crashes across restarts, which is how a loop is told from a blip. */
const CRASH_KEY = "als.crashes";

/**
 * A run this long without throwing is a working app, whatever happened last
 * time. Long enough to be past rehydration and the first screen, short enough
 * that a student who fixes it by restarting is not still one crash away from
 * being offered the destructive button.
 */
const SETTLED_MS = 15000;

/**
 * Where the second option stops being panic and starts being the answer.
 *
 * One crash is a bug on one screen. Three in a row is the stored state itself,
 * and no amount of restarting will clear it.
 */
const LOOP_THRESHOLD = 3;

async function countCrash() {
  try {
    const raw = await AsyncStorage.getItem(CRASH_KEY);
    const next = (Number(raw) || 0) + 1;
    await AsyncStorage.setItem(CRASH_KEY, String(next));
    return next;
  } catch {
    // Storage is the thing that might be broken. A crash we cannot count is
    // still a crash we can show a screen for.
    return 1;
  }
}

async function forgetCrashes() {
  try {
    await AsyncStorage.removeItem(CRASH_KEY);
  } catch {
    // Nothing to do, and nothing depends on it.
  }
}

/**
 * Restarts the app.
 *
 * `reloadAsync` throws where updates are disabled, which is every development
 * build — so the caller keeps a way to carry on without it rather than leaving
 * a button that silently does nothing.
 */
async function restart() {
  await Updates.reloadAsync();
}

// --- The screen -------------------------------------------------------------

function Action({ label, hint, tone = "plain", onPress }) {
  const danger = tone === "danger";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        borderRadius: 14,
        borderWidth: danger ? 1 : 0,
        borderColor: COLORS.line,
        backgroundColor: danger ? COLORS.canvas : COLORS.primary,
        paddingVertical: 14,
        paddingHorizontal: 18,
      }}
      className="active:opacity-80"
    >
      <Text
        style={{ color: danger ? COLORS.ink : COLORS.canvas }}
        className="font-jk-semi text-[15px] text-center"
      >
        {label}
      </Text>
      {hint ? (
        <Text
          style={{ color: danger ? COLORS.muted : "#FFFFFFCC" }}
          className="font-jk text-[11.5px] leading-[16px] text-center mt-1"
        >
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * What a student sees.
 *
 * No stack trace, no error code, no apology paragraph. The three things worth
 * saying are that their work is safe, that this was reported without them
 * having to do anything, and which button to press.
 *
 * The type is the app's own rather than the system face: a crash screen that
 * looks like it came from somewhere else reads as the phone having failed, and
 * people reinstall over that.
 */
function CrashScreen({ onRetry }) {
  const [crashes, setCrashes] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    countCrash().then(setCrashes);
  }, []);

  const looping = crashes >= LOOP_THRESHOLD;

  const reload = async () => {
    try {
      await restart();
    } catch {
      // Development, or updates switched off. Re-rendering the tree is the
      // nearest thing available and often enough for a transient fault.
      onRetry();
    }
  };

  /**
   * The last resort, and it costs something — so it says what it costs.
   *
   * Only the persisted store goes. The session is inside it, so this signs the
   * student out too, and anything filed since the last successful sync is gone
   * with it. Everything the server already has comes back on the next sign-in,
   * which is what makes this survivable rather than final.
   */
  const wipe = async () => {
    try {
      await AsyncStorage.removeItem(STORE_KEY);
      await forgetCrashes();
    } catch {
      // If even this fails there is nothing left to try from in here.
    }

    try {
      await restart();
    } catch {
      onRetry();
    }
  };

  return (
    <View className="flex-1 bg-canvas justify-center px-7">
      <Text className="font-jk-bold text-ink text-[26px] leading-[33px]">
        {looping ? "The app keeps stopping" : "Something went wrong"}
      </Text>

      <Text className="font-jk text-muted text-[14px] leading-[21px] mt-3">
        {looping
          ? "Restarting has not cleared it, which usually means the copy of your coursework saved on this phone is the problem rather than any one screen."
          : "This is a fault in the app, not in anything you filed. Your coursework is safe, and we have already been told about it."}
      </Text>

      <View className="gap-y-3 mt-8">
        <Action
          label="Restart the app"
          hint={looping ? "Worth one more try" : undefined}
          onPress={reload}
        />

        {looping ? (
          confirming ? (
            <Action
              tone="danger"
              label="Yes, clear it"
              hint="Signs you out. Anything not yet synced is lost."
              onPress={wipe}
            />
          ) : (
            <Action
              tone="danger"
              label="Clear this phone's copy"
              hint="Everything already synced comes back when you sign in."
              onPress={() => setConfirming(true)}
            />
          )
        ) : null}
      </View>
    </View>
  );
}

// --- The boundary -----------------------------------------------------------

/**
 * Catches, reports, and hands over to `CrashScreen`.
 *
 * A class because `componentDidCatch` has no hook equivalent — this is the one
 * place in the app where that is still true, and it is why reporting goes
 * through `reportCrash` rather than through `usePostHog`. That function is
 * silent where analytics is off and never throws, so a crash screen can never
 * itself crash on a missing client.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    // A run that gets this far is a working app, whatever the last one did.
    // Without this the counter only ever climbs, and a student who hit one bad
    // screen three times over a term would be offered the destructive button
    // for a transient fault.
    this.settle = setTimeout(forgetCrashes, SETTLED_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.settle);
  }

  componentDidCatch(error, info) {
    clearTimeout(this.settle);

    reportCrash(error, {
      component_stack: info?.componentStack ?? "",
      // Separates "one screen throws" from "the app cannot start", which are
      // different bugs with the same stack trace.
      boundary: this.props.name ?? "root",
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return <CrashScreen onRetry={() => this.setState({ error: null })} />;
  }
}
