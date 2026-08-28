/**
 * The one place a request to the ALS API is made.
 *
 * Every screen goes through `src/api/endpoints.js`, which goes through here.
 * That is deliberate: the timeout, the auth header, the error envelope and the
 * `{ data, error }` contract are things every call needs and none of them
 * should be re-implemented in a button handler.
 *
 * Two rules the rest of the app relies on:
 *
 *  - Ids are minted on the device (`src/lib/ids.js`). That is what makes every
 *    write idempotent: the same note can be pushed any number of times and
 *    stays one row, because the upsert matches on an id the client chose.
 *  - Every function resolves to `{ data, error }` and never throws, so a caller
 *    in a button handler cannot take the screen down with an unhandled
 *    rejection.
 */

import { recordFailure } from "@/lib/diagnostics";

/** The hosted API. `EXPO_PUBLIC_API_URL` overrides it for staging or a laptop. */
const DEFAULT_API_URL = "https://als.ardena.xyz";

/**
 * Origin only.
 *
 * A trailing slash is stripped here rather than trusted, because
 * `https://host/` joined to `/api/v1/me` gives a double slash and a 404 that
 * looks like a routing bug on the server.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL
).replace(/\/+$/, "");

/**
 * The version lives here, not in twenty-odd path strings.
 *
 * `/health` sits outside it, which is why this is a prefix applied by
 * `endpoints.js` rather than glued on inside `request`.
 */
export const API_V1 = "/api/v1";

/** Reads better at a call site than a truthiness check on a URL string. */
export const isBackendConfigured = Boolean(API_BASE_URL);

/**
 * Long enough for a cold container on a phone connection, short enough that a
 * stalled request settles rather than leaving a screen on a spinner until the
 * app is killed. The tutor streams and sets its own, much longer, budget.
 */
const TIMEOUT_MS = 20000;

export const OFFLINE = "Could not reach the server. Check your connection.";

/**
 * One fetch, with the parts every call would otherwise repeat.
 */
export async function request(path, { method = "GET", body, token, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Recorded on failure so the diagnostics screen can say whether a request
  // died instantly (no route to the host) or sat there until the timeout.
  const startedAt = Date.now();

  // A caller's own signal still has to abort us, and the timeout still has to
  // fire — so both are honoured rather than one replacing the other.
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onExternalAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // Read the body once, then decide: a failed response usually carries the
    // reason, and re-reading a consumed stream throws.
    const text = await response.text();
    const payload = text ? safeParse(text) : null;

    if (!response.ok) {
      const message = payload?.message ?? `Request failed (${response.status}).`;

      // The raw body, not the parsed message: when the server returns HTML or
      // a framework's own error page, `payload` is null and the text is the
      // only thing that says what went wrong.
      recordFailure({
        source: "api",
        method,
        path,
        status: response.status,
        message,
        detail: text,
        durationMs: Date.now() - startedAt,
      });

      return { data: null, error: message, status: response.status };
    }

    return { data: payload, error: null, status: response.status };
  } catch (error) {
    const aborted = error?.name === "AbortError";
    const message = aborted
      ? "The server took too long to answer."
      : OFFLINE;

    // `error.message` is the useful half here. A wrong `EXPO_PUBLIC_API_URL`
    // or a phone that cannot see the laptop both surface as the same friendly
    // "check your connection", and only this line tells them apart.
    recordFailure({
      source: "api",
      method,
      path,
      status: 0,
      message,
      detail: aborted
        ? `Aborted after ${TIMEOUT_MS}ms. Base URL: ${API_BASE_URL}`
        : `${error?.name ?? "Error"}: ${error?.message ?? error}\nBase URL: ${API_BASE_URL}`,
      durationMs: Date.now() - startedAt,
    });

    return { data: null, error: message, status: 0 };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onExternalAbort);
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

/** Liveness. Used by the connection banner, not by any screen's data path. */
export function health() {
  return api.get("/health");
}
