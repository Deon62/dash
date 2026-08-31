import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useStudyStore } from "@/store/useStudyStore";
import { sync } from "@/lib/sync";

/**
 * Watching a document until the server has finished reading it.
 *
 * There is no status endpoint, and that is a deliberate shape rather than a
 * gap: `POST /materials/complete` answers once, at upload time, and never
 * again. Every status change after that reaches the device through `GET /sync`
 * and nowhere else. So something has to ask — and it has to stop asking, which
 * is the half that is easy to get wrong.
 *
 * The condition for polling is "is anything actually in flight", not "is a
 * screen open". A student who files a PDF and immediately switches to the tutor
 * still needs the card to be right when they come back, and a poll keyed to a
 * mounted list would leave it stale on every other screen in the app.
 */

/**
 * The statuses that can still move on their own.
 *
 * `unreadable` and `blocked` are absent on purpose. Both are terminal — the
 * server has read the file and reached a verdict — so polling for them is a
 * request that can only ever return the same answer, for the life of the
 * install. That single omission is the difference between this and the bug it
 * replaces.
 *
 * `uploading` and `queued` are absent too, for the opposite reason: those bytes
 * have not reached the server, so there is nothing there to ask about yet. The
 * upload itself moves them on.
 */
const SETTLING = new Set(["pending", "reading"]);

/** Materials the server is still working on. */
export function settlingMaterials(materials) {
  return (materials ?? []).filter((material) => SETTLING.has(material.uploadStatus));
}

export function isSettling(material) {
  return SETTLING.has(material?.uploadStatus);
}

/**
 * How often to ask.
 *
 * Extraction is usually under ten seconds for a normal PDF and a few for a
 * photo, so this is short enough that a card settles while the student is still
 * looking at it. It runs only while something is genuinely in flight, so the
 * steady state is no requests at all rather than a heartbeat.
 */
const POLL_MS = 6000;

/**
 * How long to keep asking before giving up.
 *
 * A ceiling exists because the loop's stop condition is a status change, and a
 * status that never changes — a worker lost, a queue wedged — would otherwise
 * poll for as long as the app is open. The server recovers anything stuck in
 * `running` after fifteen minutes, so this sits past that: the recovery has had
 * its chance, and a foreground or a pull-to-refresh will pick up whatever
 * happened next.
 */
const GIVE_UP_MS = 20 * 60 * 1000;

/**
 * Polls sync while any material is being read, and stops when none is.
 *
 * Mounted once, from the root layout. Also pulls on every return to the
 * foreground: a phone backgrounded mid-upload comes back to a card that has
 * been wrong for as long as it was away, and that return is the moment the
 * student is looking straight at it.
 */
export function useExtractionWatch() {
  const materials = useStudyStore((state) => state.materials);
  const isAuthenticated = useStudyStore((state) => state.isAuthenticated);

  // The ids being waited on, as a stable string. Depending on `materials`
  // directly would re-arm the interval on every unrelated write — renaming a
  // note, archiving one — and an interval that keeps restarting never fires.
  const waitingOn = settlingMaterials(materials)
    .map((material) => material.id)
    .sort()
    .join(",");

  const startedAt = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || !waitingOn) {
      startedAt.current = 0;
      return undefined;
    }

    if (!startedAt.current) startedAt.current = Date.now();

    const timer = setInterval(() => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        clearInterval(timer);
        return;
      }
      // `sync()` and not `pullSync()`. The forced variant exists for a person
      // pulling a list down, and it skips the "already syncing" guard on
      // purpose. On a slow connection a request can outlast this interval, and
      // forcing here would stack a second sync on top of the first — two
      // pushes of the same rows racing each other's cursor, which is how a
      // cursor ends up ahead of the data. The guard makes a tick that lands
      // mid-sync a no-op, which is exactly right: one is already happening.
      sync();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [isAuthenticated, waitingOn]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;

      const state = useStudyStore.getState();
      if (!state.isAuthenticated) return;
      // Only when there is something to find out. The account sync already
      // pulls on a long enough absence; this is the extra one for a phone that
      // was away for ten seconds with a document mid-read, which that check
      // deliberately ignores.
      if (!settlingMaterials(state.materials).length) return;

      sync();
    });

    return () => subscription.remove();
  }, []);
}
