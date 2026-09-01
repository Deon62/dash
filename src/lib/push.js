import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { account } from "@/api/endpoints";
import { authed, deviceId, registerDevice } from "@/lib/session";
import { sync } from "@/lib/sync";
import { useStudyStore } from "@/store/useStudyStore";
import { COLORS } from "@/theme/colors";

/**
 * Push notifications, from the device's side.
 *
 * The server decides everything — which reminder, for whom, at what hour, and
 * whether the student is inside their own quiet hours. See `push.md`. This file
 * is only responsible for the three things the server cannot do for itself:
 * getting permission, handing over an Expo push token, and knowing where to go
 * when a notification is tapped.
 *
 * `registerDevice` in `src/lib/session.js` has always been called on launch,
 * and has always been called with `pushToken = null` — so every account had a
 * device row that could never receive anything. On the server that reads as
 * `has_devices: true, delivered: 0`, which looks like a credentials problem and
 * is not. Passing a real token is the change that makes the whole feature work.
 */

/**
 * What happens to a notification that arrives while the app is open.
 *
 * Shown, and that is not the obvious choice. The alternative is to suppress it
 * on the grounds that the student is already here — but a deadline reminder is
 * about something they are *not* looking at, and a reminder silently swallowed
 * because the app happened to be foregrounded is a reminder that failed. No
 * sound, though: a banner is enough for someone already holding the phone.
 *
 * Set at module scope so it is in place before any notification can arrive,
 * including one that woke the app.
 */
/**
 * The unit currently on screen, or null.
 *
 * Module scope rather than store state because it is not the student's data and
 * nothing renders from it — it exists for one decision, taken inside a handler
 * that runs outside React and cannot read a hook.
 *
 * The server cannot make this decision for us. It has no idea what the app is
 * showing, so it sends the notification and leaves the suppression to the only
 * side that knows.
 */
let viewingUnit = null;

/** Called by the unit screen on focus, and with `null` on blur. */
export function setViewingUnit(unitId) {
  viewingUnit = unitId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data;

    /**
     * "Four pages are ready", banner-ed over the four cards that just turned
     * ready in front of them.
     *
     * The only notification worth swallowing, and only in this exact case: the
     * student is looking at the unit, the polling has already moved the cards,
     * and the banner is announcing something they watched happen. Silent, not
     * dropped — it still lands in the notification list, because "your notes
     * are ready" is worth finding later even when it was not worth interrupting
     * for.
     */
    const redundant = data?.kind === "material" && data?.id === viewingUnit;

    return {
      shouldShowBanner: !redundant,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

/**
 * The Android channel.
 *
 * Android 8 and up will not show a notification that has no channel, and it
 * must exist *before* permission is requested or the first prompt describes
 * nothing. One channel rather than one per kind: a student who wants deadline
 * reminders but not session reminders has switches for that in the app, and
 * the server honours them — two OS-level channels would be a second, competing
 * set of controls that the server knows nothing about.
 */
const CHANNEL = "reminders";

async function ensureChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Reminders",
    description: "Deadlines and session times from your timetable.",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: COLORS.primary,
  });
}

/** The EAS project the token is minted against. Without it there is no token. */
const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId ??
  null;

/**
 * An Expo token, or null with a reason.
 *
 * `push.md` is explicit that the server stores whatever it is given and then
 * skips anything that is not an Expo token, without complaint — so a junk value
 * is worse than none: it makes the account look reachable when it is not.
 * Nothing but a real `ExponentPushToken[...]` leaves this function.
 */
async function fetchToken() {
  // A simulator has no push service behind it, and asking produces an error
  // that reads like a configuration fault rather than the platform limit it is.
  if (!Device.isDevice) return { token: null, reason: "simulator" };
  if (!projectId) return { token: null, reason: "no-project-id" };

  await ensureChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  // Only ask where the OS will actually show a prompt. Calling request on a
  // denied permission returns denied without showing anything, which would
  // leave the app believing it had asked.
  if (status !== "granted" && existing.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }

  if (status !== "granted") return { token: null, reason: "denied" };

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });

  return /^Expo(nent)?PushToken\[.+\]$/.test(data ?? "")
    ? { token: data, reason: null }
    : { token: null, reason: "bad-token" };
}

/**
 * Hands the server a token for this handset. Safe to call on every launch.
 *
 * The device row is a PUT on an id the device minted, so this updates one row
 * rather than piling up installations.
 */
export async function registerForPush() {
  try {
    const { token, reason } = await fetchToken();

    // Still register without a token: the row carries the platform and app
    // version, which is what makes a support conversation possible at all. The
    // server simply has nothing to send to.
    await registerDevice(token);

    return { token, reason };
  } catch (error) {
    // Never throws. This runs from an effect on launch, and a rejection here
    // would take down the screen that mounted it over a feature nobody has
    // asked for yet.
    return { token: null, reason: "error" };
  }
}

/** Clears the token without signing the device out. */
export async function unregisterPush() {
  return authed((token) => account.unregisterDevice(deviceId(), token));
}

// --- Registration, on launch -------------------------------------------------

/**
 * Registers once a session exists, and again whenever the token changes.
 *
 * Expo re-mints a token on reinstall, restore and some OS upgrades. A stale one
 * is a notification that goes nowhere and says nothing about it, so the
 * listener matters as much as the launch call.
 */
export function usePushRegistration() {
  const isAuthenticated = useStudyStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    registerForPush();

    const subscription = Notifications.addPushTokenListener(({ data }) => {
      if (data) registerDevice(data);
    });

    return () => subscription.remove();
  }, [isAuthenticated]);
}

/** The OS permission, for a settings screen to be honest about. */
export function usePushPermission() {
  const [status, setStatus] = useState(null);

  const read = async () => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      setStatus(permission);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    read();
  }, []);

  return { status, refresh: read };
}

// --- Taps --------------------------------------------------------------------

/**
 * Where a tapped notification should land.
 *
 * The payload is `{ kind, id }` — see §4 of `push.md`.
 *
 * There is no event-detail route in this app; a deadline lives as a dot on the
 * calendar and inside its unit. So a deadline opens the calendar *on its own
 * day*, which is the screen that can actually show it, and a session opens the
 * timetable. Sending both to a generic list would be a tap that answers a
 * different question from the one the notification asked.
 */
function destinationFor(data) {
  const kind = data?.kind;
  const id = data?.id ? String(data.id) : null;

  if (kind === "deadline" && id) {
    return { pathname: "/(tabs)", params: { event: id } };
  }

  if (kind === "class") return { pathname: "/timetable" };

  /**
   * A document the server has finished reading. `id` is the **unit**, not the
   * material, and that is deliberate on the server's side: one notification
   * covers every document that settled in that unit, so it has no single
   * subject. Opening the unit puts the whole batch on screen.
   */
  if (kind === "material" && id) return { pathname: `/unit/${id}` };

  // `test` carries no id, and anything unrecognised is a payload from a newer
  // server than this build. The list of what has been sent is the honest
  // destination for both.
  return { pathname: "/notifications" };
}

/**
 * Routes taps, including the one that launched the app.
 *
 * Two paths, and both are needed. The listener catches a tap while the app is
 * running or backgrounded; `getLastNotificationResponseAsync` catches the tap
 * that started the process, which the listener is mounted too late to see —
 * that is the cold-start case, and it is the most common one for a reminder.
 *
 * @param router  An expo-router router. Passed in rather than hooked here so
 *   this can only be mounted below the navigator, where routing works.
 */
export function usePushTaps(router) {
  useEffect(() => {
    let handled = false;

    const go = (response) => {
      const data = response?.notification?.request?.content?.data;
      if (!data) return;

      const to = destinationFor(data);
      router.push(to);

      /**
       * The notification is a nudge, not the data.
       *
       * It says four documents are ready; the cards come from sync as they
       * always do. Without this the unit opens showing whatever the last pull
       * left behind — which, for a tap that arrived while the app was closed,
       * is the "waiting to be read" state the notification just contradicted.
       *
       * Unawaited, and after the push: the screen should appear now and fill
       * in, not wait on a request before it will draw.
       */
      if (data.kind === "material") sync();
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        // Guard against the cold-start response being handled twice if the
        // listener also reports it.
        if (response && !handled) {
          handled = true;
          go(response);
        }
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handled = true;
        go(response);
      },
    );

    return () => subscription.remove();
  }, [router]);
}
