import { useEffect } from "react";
import { AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { create } from "zustand";

import { release } from "@/api/endpoints";
import { DEVICE } from "@/lib/session";

/**
 * Getting a new version onto a student's phone. Two mechanisms, and they answer
 * different questions.
 *
 * **OTA** (`expo-updates`, below) ships JavaScript, styles and images. It needs
 * nothing from the backend and the student sees nothing: the bundle downloads
 * in the background and the *next* launch is the new one. That covers roughly
 * nine releases in ten, including a changed limit or a new pricing card.
 *
 * **A store update** is for anything native — an SDK bump, a new permission, an
 * icon. Only a person tapping Update in the store can deliver one, so the app's
 * job is to know it is behind and say so. That is what `GET /app/release`
 * answers, and what everything below the OTA section is for.
 *
 * Neither of these is something the student asked for, and that governs every
 * failure here: a check that cannot reach the server is silent, always. An
 * error toast about an update nobody requested is pure noise on a connection
 * that drops all day.
 */

// --- OTA --------------------------------------------------------------------

/**
 * Pulls a JavaScript update and restarts into it, now.
 *
 * Not called on launch, and that is the point. `checkAutomatically: ON_LOAD` in
 * `app.json` already fetches in the background and applies on the next launch,
 * which is the right default — swapping the bundle out from under someone
 * mid-sentence is worse than a one-launch delay.
 *
 * This is the explicit escape hatch for a fix urgent enough to interrupt for,
 * and it is exported rather than wired to anything so that using it stays a
 * decision somebody makes.
 */
export async function applyUrgentUpdate() {
  // `expo-updates` is inert in development; asking it anything there answers
  // nothing useful and throws on some SDK versions.
  if (__DEV__) return false;

  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return false;

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch {
    // Offline, or the update server is unreachable. Silent by design.
    return false;
  }
}

// --- The store build --------------------------------------------------------

/** Where a dismissal is remembered. Its own key, not the account store. */
const DISMISSED_KEY = "als-update-dismissed";

/**
 * What the app knows about being out of date.
 *
 * Its own tiny store rather than a slice of `useStudyStore`, for two reasons.
 * It is not the student's data — nothing here survives a reinstall or belongs
 * to an account — and the modal has to work for somebody who cannot sign in,
 * which is the whole reason the endpoint takes no token. Persisting it into the
 * account store would tie the one check that must survive a broken session to
 * the state a broken session clears.
 */
export const useAppUpdate = create((set) => ({
  /** The server's answer, or null before the first one lands. */
  release: null,
  /** The `latest_version` the student has already waved away, from disk. */
  dismissed: null,

  setRelease: (value) => set({ release: value }),
  setDismissed: (version) => set({ dismissed: version }),
}));

/**
 * Asks the server, once per call, and files the answer.
 *
 * Never throws and never surfaces an error: `api` already resolves to
 * `{ data, error }`, and an unreachable server here means the student carries
 * on with the build they have, which is exactly right.
 */
export async function checkForStoreUpdate() {
  /**
   * The same `DEVICE` the device row is registered with, deliberately.
   *
   * It resolves to `nativeApplicationVersion` — the installed binary, never the
   * OTA update id, because only a store install changes which binary is
   * running. Sharing it with `registerDevice` is what keeps the floor and the
   * adoption count that sizes it measuring the same thing.
   */
  const { data, error } = await release.check({
    platform: DEVICE.platform,
    version: DEVICE.appVersion,
  });

  if (error || !data) return null;

  useAppUpdate.getState().setRelease(data);
  return data;
}

/**
 * Remembers a dismissal against the version it was for.
 *
 * Keyed on `latest_version` rather than being a bare "don't ask again" flag:
 * waving away 1.5.0 must not also swallow 1.6.0 when it lands three weeks
 * later, which is how an update card ends up being shown exactly once in the
 * life of an install.
 */
export async function dismissUpdate(version) {
  if (!version) return;
  useAppUpdate.getState().setDismissed(version);
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // The dismissal still holds for this session. Losing it across a restart is
    // a card shown twice, which is not worth failing anything over.
  }
}

async function loadDismissed() {
  try {
    const stored = await AsyncStorage.getItem(DISMISSED_KEY);
    useAppUpdate.getState().setDismissed(stored ?? "");
  } catch {
    useAppUpdate.getState().setDismissed("");
  }
}

/** Opens the store listing. The only action either prompt offers. */
export function openStore(url) {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    // A device with no browser, or a malformed URL from the release row. There
    // is nothing useful to say — the student is already looking at a screen
    // that tells them to update.
  });
}

/**
 * Keeps the answer fresh for as long as the app is open.
 *
 * On launch **and on every return to the foreground**. A phone that has been
 * open for three days never relaunches, and that is precisely the handset still
 * running the build somebody is trying to switch off. The response is cached
 * for five minutes server-side, so a foreground check costs nothing worth
 * counting.
 *
 * Deliberately not part of `refreshAccount`: everything in there needs a
 * session, and this must work without one.
 */
export function useStoreUpdateCheck() {
  useEffect(() => {
    loadDismissed();
    checkForStoreUpdate();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") checkForStoreUpdate();
    });

    return () => subscription.remove();
  }, []);
}

/**
 * What, if anything, to show the student.
 *
 * `required` is never inferred from simply being behind. It is true only when
 * an administrator has raised `minimum_version` past the build in hand —
 * forcing an update interrupts somebody mid-revision, usually the night before
 * a CAT, and that has to be a decision a person made rather than a side effect
 * of shipping a release.
 */
export function useUpdatePrompt() {
  const value = useAppUpdate((state) => state.release);
  const dismissed = useAppUpdate((state) => state.dismissed);

  if (!value) return { required: false, available: false };

  const required = Boolean(value.update_required);

  return {
    required,
    // A dismissal never suppresses a forced update, and the ordering here is
    // what guarantees it: a card waved away last week must not be what keeps a
    // build the server has since disowned on the network.
    available:
      !required &&
      Boolean(value.update_available) &&
      // `null` means the dismissal has not been read off disk yet. Waiting is
      // right — showing the card and hiding it a beat later is a flash of
      // something a student may already have dealt with.
      dismissed !== null &&
      dismissed !== value.latest_version,
    version: value.latest_version ?? "",
    minimum: value.minimum_version ?? "",
    notes: value.notes ?? "",
    storeUrl: value.store_url ?? "",
  };
}
