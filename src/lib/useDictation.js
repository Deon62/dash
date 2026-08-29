import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speaking into a text field.
 *
 * The module is pulled in with a guarded `require` rather than an `import`.
 * `expo-speech-recognition` resolves its native module at import time and
 * throws if it is not there — so a plain import takes down every screen that
 * touches this file the moment the app runs on Expo Go or a dev client built
 * before the dependency was added. An optional capability must never be able
 * to do that: here it simply reports itself unavailable and the mic button
 * says why.
 */
let Speech = null;
try {
  // eslint-disable-next-line global-require
  Speech = require("expo-speech-recognition");
} catch {
  Speech = null;
}

const module_ = Speech?.ExpoSpeechRecognitionModule ?? null;

/** True only in a build that actually contains the native module. */
export const isDictationAvailable = Boolean(module_);

const UNAVAILABLE =
  "Voice input needs a new build of the app. It will work in the next one.";

/**
 * The transcript is written back through `onText` as it arrives rather than
 * kept in here, so the composer's draft stays the single source of truth — a
 * student must be able to speak a sentence, then fix a word by typing, without
 * the next interim result wiping the correction.
 *
 * `baseline` is what was already in the field when dictation started. Every
 * update replaces only the spoken tail, which is what stops a long dictation
 * from repeating itself as the engine revises earlier words.
 */
export function useDictation({ onText }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const baseline = useRef("");
  // Whether results are still wanted. The engine keeps talking for a moment
  // after it is asked to stop — the final, tidied-up transcript arrives after
  // `stop()` returns — so this is what tells a late result that the field it
  // would write into has already been sent and emptied.
  const active = useRef(false);
  const handle = useRef(onText);
  handle.current = onText;

  // Subscriptions are set up in an effect rather than through the package's
  // own hooks, because those cannot be called at all when the module is
  // missing — and a hook that only sometimes runs is not a hook.
  useEffect(() => {
    if (!module_) return undefined;

    const onResult = module_.addListener("result", (event) => {
      if (!active.current) return;

      const said = event.results?.[0]?.transcript ?? "";
      if (!said) return;

      const prefix = baseline.current;
      handle.current(prefix ? `${prefix.replace(/\s+$/, "")} ${said}` : said);
    });

    const onEnd = module_.addListener("end", () => setListening(false));

    const onError = module_.addListener("error", (event) => {
      setListening(false);
      // "no-speech" is someone tapping the mic and saying nothing. That is not
      // a failure worth putting on screen.
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(event.message || "Speech recognition is unavailable.");
    });

    return () => {
      onResult.remove();
      onEnd.remove();
      onError.remove();
    };
  }, []);

  /**
   * Stops listening but keeps the last thing said.
   *
   * This is the mic button being tapped a second time, so the final result is
   * still wanted — it is usually a tidier version of the interim text already
   * in the field.
   */
  const stop = useCallback(() => {
    module_?.stop();
    setListening(false);
  }, []);

  /**
   * Stops listening and throws away whatever is still coming.
   *
   * For sending: the draft has just been posted to the thread and the composer
   * emptied, and the engine's final result would otherwise land a beat later
   * and put the question the student just asked straight back in the box.
   */
  const cancel = useCallback(() => {
    active.current = false;
    baseline.current = "";
    if (module_?.abort) module_.abort();
    else module_?.stop();
    setListening(false);
  }, []);

  const start = useCallback(async (currentText = "") => {
    setError(null);

    if (!module_) {
      setError(UNAVAILABLE);
      return;
    }

    const permission = await module_.requestPermissionsAsync();
    if (!permission.granted) {
      setError("ALS needs microphone access to hear you.");
      return;
    }

    baseline.current = currentText;
    active.current = true;
    setListening(true);

    module_.start({
      lang: "en-US",
      // Interim results are what make it feel like the words appear as you
      // speak rather than in one lump at the end.
      interimResults: true,
      continuous: true,
    });
  }, []);

  const toggle = useCallback(
    (currentText) => (listening ? stop() : start(currentText)),
    [listening, start, stop]
  );

  return {
    available: isDictationAvailable,
    listening,
    error,
    start,
    stop,
    cancel,
    toggle,
    clearError: () => setError(null),
  };
}
