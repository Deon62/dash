/**
 * The seam where a backend plugs in.
 *
 * Nothing calls this yet — the app is local-first and every screen reads from
 * the store. It exists so that when a server appears, the change is confined
 * to `src/api/*` and the store's sync actions, rather than turning into fetch
 * calls scattered through screens.
 *
 * Two rules the rest of the app already relies on:
 *
 *  - Ids are minted on the device (`src/lib/ids.js`). That is what makes every
 *    write idempotent: the same note can be pushed any number of times and
 *    stays one row, because the upsert matches on an id the client chose.
 *  - Every function resolves to `{ data, error }` and never throws, matching
 *    `src/lib/auth.js`, so a caller in a button handler cannot take the screen
 *    down with an unhandled rejection.
 */

/**
 * Set at build time. Absent means "no backend", which is a supported state:
 * every screen reads from the store and works offline.
 *
 * The origin only — a trailing slash is stripped here rather than trusted,
 * because `https://host/` joined to `/api/v1/me` gives a double slash and a
 * 404 that looks like a routing bug on the server.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") || null;

/**
 * The version lives here, not in twenty-odd path strings.
 *
 * `/health` sits outside it, which is why this is a prefix applied by
 * `endpoints.js` rather than glued on inside `request`.
 */
export const API_V1 = "/api/v1";

export const isBackendConfigured = Boolean(API_BASE_URL);

const TIMEOUT_MS = 15000;

const NOT_CONFIGURED = {
  data: null,
  error: "No server is configured for this build.",
};

/**
 * One fetch, with the parts every call would otherwise repeat.
 *
 * The timeout matters more than it looks: without it a request on a stalled
 * connection never settles, and a screen that awaited it sits on a spinner
 * until the app is killed.
 */
export async function request(path, { method = "GET", body, token, signal } = {}) {
  if (!isBackendConfigured) return NOT_CONFIGURED;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // Read the body once, then decide: a failed response usually carries the
    // reason, and re-reading a consumed stream throws.
    const text = await response.text();
    const payload = text ? safeParse(text) : null;

    if (!response.ok) {
      return {
        data: null,
        error: payload?.message ?? `Request failed (${response.status}).`,
        status: response.status,
      };
    }

    return { data: payload, error: null, status: response.status };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { data: null, error: "The server took too long to answer." };
    }
    return { data: null, error: "Could not reach the server." };
  } finally {
    clearTimeout(timer);
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
