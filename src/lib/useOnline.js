import { useSyncExternalStore } from "react";
import * as Network from "expo-network";

/**
 * Whether the phone can reach the internet.
 *
 * Event-driven rather than inferred from failed requests. The app used to find
 * out it was offline only when something it had already sent came back empty —
 * so a student could browse for a minute with the radio off and be told at the
 * exact moment they asked for a quiz. Android broadcasts connectivity changes;
 * this listens to them, so the answer is known before anything is attempted.
 *
 * `isInternetReachable` rather than `isConnected`, which is the difference
 * between being attached to a wifi access point and that access point having a
 * working uplink — a campus network behind a captive portal is `isConnected`
 * and useless. On iOS the platform does not distinguish and the field mirrors
 * `isConnected`.
 *
 * **Unknown counts as online.** The value is null before the first event
 * arrives and on platforms that decline to answer, and defaulting that to
 * "offline" would flash an offline screen over a working app on every cold
 * start. Being briefly wrong in the direction of letting someone through is
 * the cheaper mistake: a request made in that window fails honestly on its own.
 *
 * One subscription for the whole app, not one per component. Every `Screen` in
 * the app reads this, and the tab navigator keeps four of them mounted at
 * once — a listener each would be four native subscriptions answering the same
 * question, and four separate copies of the answer to disagree with each other
 * mid-transition.
 */

let online = true;

/** Components waiting to be told. */
const listeners = new Set();

/** Live while anything is mounted; null when the last listener goes. */
let subscription = null;

function publish(next) {
  if (next === online) return;
  online = next;
  listeners.forEach((listener) => listener());
}

function read(state) {
  if (!state) return;
  const reachable = state.isInternetReachable ?? state.isConnected ?? null;
  publish(reachable !== false);
}

function subscribe(listener) {
  listeners.add(listener);

  if (!subscription) {
    subscription = Network.addNetworkStateListener(read);

    // The listener only fires on a *change*, so the current state has to be
    // asked for as well — otherwise an app opened with the radio already off
    // believes it is online until the radio comes back.
    Network.getNetworkStateAsync().then(read).catch(() => {});
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      subscription?.remove?.();
      subscription = null;
    }
  };
}

const snapshot = () => online;

/** True while the internet is reachable, as far as the OS will say. */
export function useOnline() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Asks the OS again, now.
 *
 * What the "Check again" button on the offline screen runs. The listener
 * usually gets there first — connectivity coming back is an event, and the
 * screen lifts itself. This is for the case it does not: a captive portal the
 * student has just signed in to on another tab looks identical to the OS until
 * something asks.
 */
export async function recheckOnline() {
  try {
    read(await Network.getNetworkStateAsync());
  } catch {
    // Nothing to report. The screen stays as it is and the button can be
    // pressed again.
  }
}
