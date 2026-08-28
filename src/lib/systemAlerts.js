import { CloudOff, FileWarning, Clock } from "lucide-react-native";

import { hasPendingChanges } from "@/lib/sync";

/**
 * What the app itself needs to tell a student, as notifications.
 *
 * These used to be cards at the foot of whichever screen noticed the problem —
 * a sync warning under the profile links, a payment note below the plans. That
 * was the wrong place twice over: it put a background condition in the middle
 * of a page about something else, and it meant the message only existed while
 * you happened to be standing on the screen that raised it.
 *
 * They belong here instead. The bell is where the app already says "this needs
 * you", it is reachable from anywhere, and a status that is genuinely still
 * true reads the same wherever you were when it started being true.
 *
 * Derived, never stored. Each one is a pure function of state, so an alert
 * cannot outlive its own cause — the sync that succeeds removes the sync
 * warning, and the file that finishes uploading removes its own.
 */

/**
 * Reads the store snapshot and returns notification rows.
 *
 * Same shape the timetable and deadline items use, so the screen renders them
 * in one list without knowing which came from where.
 */
export function systemAlerts(state) {
  const alerts = [];

  // Work stranded on the handset. Gated on there actually being some: a sync
  // that failed and was then quietly fixed by the next one has nothing left to
  // warn about, and a warning with no subject is how people learn to ignore
  // the bell.
  if (state.syncError && hasPendingChanges(state)) {
    alerts.push({
      id: "system-sync",
      Icon: CloudOff,
      title: "Some changes haven't reached your account",
      body: "They are safe on this phone and will go up on their own once you are back online.",
      urgent: false,
      // Above the timetable, below anything overdue: it matters, but not more
      // than a deadline today.
      sort: -0.75,
    });
  }

  const failed = state.materials.filter(
    (material) => material.uri && material.uploadStatus === "failed",
  );

  if (failed.length) {
    alerts.push({
      id: "system-uploads",
      Icon: FileWarning,
      title:
        failed.length === 1
          ? `“${failed[0].title}” hasn't uploaded`
          : `${failed.length} files haven't uploaded`,
      // Says what it costs, because that is the part a student can act on:
      // the item is visible either way, so the only real consequence is that
      // the tutor cannot read it yet.
      body: "The tutor can't read them until they do. We'll keep trying whenever you're online.",
      urgent: false,
      sort: -0.6,
    });
  }

  // A plan bought but not yet confirmed. Kora's webhook usually settles this
  // within a minute or two, so it is worth saying rather than leaving someone
  // wondering whether their money went anywhere.
  if (state.subscription && state.subscription.verified === false) {
    alerts.push({
      id: "system-payment",
      Icon: Clock,
      title: "Your payment is still being confirmed",
      body: "Mobile money can take a minute. Your plan unlocks as soon as it clears. Nothing more to do.",
      urgent: false,
      sort: -0.7,
    });
  }

  return alerts;
}

/** Whether the bell should carry a dot for something the app itself raised. */
export function hasSystemAlerts(state) {
  return systemAlerts(state).length > 0;
}
