/**
 * Switches that exist only while the app is being built.
 *
 * Everything here is a deliberate deviation from how the app should behave in
 * a student's hands. They live in one file, named for what they do rather than
 * where they are used, so shipping is a matter of reading this list and turning
 * them off — not hunting for a condition someone buried in a screen.
 */

/**
 * Show the intro on every launch instead of once per install.
 *
 * Implemented by not persisting the `introSeen` flag, so the intro can still be
 * completed and dismissed normally within a session — it simply forgets by the
 * next cold start. Off: new users see it once and never again.
 */
export const ALWAYS_SHOW_INTRO = false;

/**
 * Show the Diagnostics row in Settings, and with it the on-device failure log.
 *
 * Defaults to `__DEV__`, so it is there in Expo Go and in a dev client and
 * gone from anything a student installs. Set it to `true` by hand to carry it
 * into a preview build when you are chasing something that only happens on a
 * real install — but put it back before a production build, because the log
 * records raw response bodies and those are not for a student to read.
 */
export const SHOW_DIAGNOSTICS = __DEV__;
