import { useSyncExternalStore } from "react";

/**
 * A record of what failed, on the device, while it was failing.
 *
 * The problem this solves: a request dies in Expo Go, the student (or you) see
 * one sentence — "Could not reach the server" — and the only way to learn what
 * actually happened is to open the server logs, correlate by time, and hope
 * the request reached the server at all. Half the failures worth chasing never
 * do: a timeout, a wrong `EXPO_PUBLIC_API_URL`, a 401 from an expired token, a
 * phone with no route to your laptop. None of those leave a trace anywhere but
 * here.
 *
 * Deliberately not in `useStudyStore`: that store is persisted, and a log of
 * failures is the last thing that should survive a restart or be synced to an
 * account. This one lives in memory and dies with the process, which is also
 * what keeps it safe to record response bodies in.
 */

/**
 * How many entries are kept.
 *
 * Enough to cover a session's worth of poking at a broken screen, small enough
 * that it can never be the reason the app runs out of memory. The oldest go
 * first.
 */
const LIMIT = 100;

/** Response bodies are logged, and a stack trace or an HTML error page is long. */
const MAX_DETAIL = 2000;

let entries = [];
const listeners = new Set();

/**
 * A new array identity on every change.
 *
 * `useSyncExternalStore` compares snapshots by reference, so mutating the
 * existing array in place would record the failure and never redraw the screen
 * showing it.
 */
function publish(next) {
  entries = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let counter = 0;

/**
 * Records one failure.
 *
 * Called from the API client and the tutor's streaming fetch, which is where
 * every network failure in the app funnels through. `detail` is whatever the
 * server said back, truncated: a 500 that returns an HTML error page would
 * otherwise put a page of markup into memory and into the screen.
 */
export function recordFailure({
  source,
  method = "",
  path = "",
  status = 0,
  message = "",
  detail = "",
  durationMs = null,
}) {
  counter += 1;

  const entry = {
    id: counter,
    at: new Date().toISOString(),
    source,
    method,
    path,
    status,
    message,
    detail: detail ? String(detail).slice(0, MAX_DETAIL) : "",
    durationMs,
  };

  publish([entry, ...entries].slice(0, LIMIT));
  echo(entry);
  return entry;
}

/**
 * Prints the failure to the Metro terminal.
 *
 * The reason this exists: `request()` resolves to `{ data, error }` and never
 * throws, which is what stops a button handler taking the screen down — but it
 * also means a 401, a 500 and a dead base URL all leave the terminal
 * completely silent. The only failures that reach it today are the ones that
 * crashed a render.
 *
 * `console.log`, not `console.error` or `console.warn`: both of those raise a
 * LogBox overlay on the phone, and a failing request is something you want to
 * read in the terminal, not something that should cover the screen you are
 * testing. Development only — this is noise in a student's build, and on a
 * release build there is no terminal reading it anyway.
 */
function echo(entry) {
  if (!__DEV__) return;

  const head = [
    "[FAIL]",
    entry.source,
    entry.method,
    entry.path,
    entry.status ? `-> ${entry.status}` : "-> no reply",
    entry.durationMs === null ? "" : `${entry.durationMs}ms`,
  ]
    .filter(Boolean)
    .join(" ");

  // One call, not three: Metro interleaves output from the app and the
  // bundler, and separate calls get split up by whatever else is logging.
  // Every line indented, not just the first: a stack trace or an HTML error
  // page is several lines, and left flush against the margin the continuation
  // reads as separate log output rather than part of this failure.
  const indent = (text) =>
    String(text)
      .split("\n")
      .map((line) => `        ${line}`)
      .join("\n");

  const lines = [head, entry.message && indent(entry.message), entry.detail && indent(entry.detail)];

  console.log(lines.filter(Boolean).join("\n"));
}

export function clearFailures() {
  publish([]);
}

const emptySnapshot = [];

/** The server-render snapshot, which react-native-web asks for. */
function getServerSnapshot() {
  return emptySnapshot;
}

function getSnapshot() {
  return entries;
}

/** Newest first. */
export function useFailures() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** For a badge that says how bad it has been without opening the screen. */
export function useFailureCount() {
  return useFailures().length;
}

/**
 * The whole log as text, for pasting into an issue or a chat.
 *
 * Plain text rather than JSON because the destination is nearly always a
 * message to another person, and a wall of escaped quotes helps nobody.
 */
export function failuresAsText(list) {
  if (list.length === 0) return "No failures recorded.";

  return list
    .map((entry) => {
      const head = [
        entry.at,
        entry.source,
        entry.method,
        entry.path,
        entry.status ? `HTTP ${entry.status}` : "no response",
        entry.durationMs === null ? "" : `${entry.durationMs}ms`,
      ]
        .filter(Boolean)
        .join("  ");

      return [head, entry.message, entry.detail].filter(Boolean).join("\n");
    })
    .join("\n\n");
}
