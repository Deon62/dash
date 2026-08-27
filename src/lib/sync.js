import { coursework } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * Push what changed here, pull what changed there.
 *
 * The server is the source of truth and the device holds a cache of it. This
 * file is the only thing that translates between the two, which is the point:
 * the API speaks `snake_case` and stores a class session as a weekday and two
 * times, the app speaks `camelCase` and stores it as `day`/`start`/`end`, and
 * a second place that knew both would be a second place for a field to be
 * renamed on one side only.
 *
 * Two rules make it safe to retry:
 *
 *  - Ids are minted on the device, so a push is an upsert on an id the server
 *    was given rather than one it invented. The same row pushed twice stays
 *    one row.
 *  - Deletions travel as tombstones, not as absences. A row that simply
 *    vanished would be invisible to the server, which would hand it straight
 *    back on the next pull.
 *
 * Conflicts resolve on `updated_at`, last write wins. For one student across
 * their own devices that is the right trade: the alternative is asking someone
 * revising for an exam which version of their own note they meant.
 */

/** The tables a push carries, in the order the payload names them. */
const TABLES = ["units", "sessions", "materials", "events", "chats"];

/**
 * Whether this device is holding work the server has not got.
 *
 * The question a screen actually wants to ask. A sync that failed an hour ago
 * is only worth telling someone about if something is still stranded by it —
 * a failure with nothing left to send is history, and a card about it is a
 * warning with no subject.
 */
export function hasPendingChanges(state) {
  const tombstones = state.tombstones ?? {};

  return (
    TABLES.some((table) => (tombstones[table] ?? []).length > 0) ||
    TABLES.some((table) => dirty(state[table]).length > 0)
  );
}

/**
 * Rows the device has written and the server has not acknowledged.
 *
 * `updatedAt` is required as well as `dirty`: it is the version the push is
 * acknowledged by, and a row without one could never be marked clean, so it
 * would be re-sent on every sync for the life of the install. The store
 * guarantees one on every write and on migration; this is the belt to that
 * bracer.
 */
function dirty(rows) {
  return (rows ?? []).filter((row) => row.dirty && row.updatedAt);
}

/** A tombstone, in the shape every table's rows take. */
function grave(table, entry) {
  return { ...table, id: entry.id, updated_at: entry.deletedAt, deleted_at: entry.deletedAt };
}

// --- Outbound ---------------------------------------------------------------

const toUnit = (unit) => ({
  id: unit.id,
  code: unit.code,
  title: unit.title,
  lecturer: unit.lecturer ?? "",
  updated_at: unit.updatedAt,
});

const toSession = (entry) => ({
  id: entry.id,
  unit_id: entry.unitId,
  // 0 = Sunday on both sides — the app stores what `Date.getDay()` returns and
  // the server documents the same convention, so nothing is shifted here.
  weekday: entry.day,
  starts_at: withSeconds(entry.start),
  ends_at: withSeconds(entry.end),
  room: entry.room ?? "",
  updated_at: entry.updatedAt,
});

const toMaterial = (material) => ({
  id: material.id,
  unit_id: material.unitId,
  kind: material.kind ?? "note",
  title: material.title,
  body: material.body ?? "",
  archived: Boolean(material.archived),
  updated_at: material.updatedAt,
});

const toEvent = (event) => ({
  id: event.id,
  unit_id: event.unitId ?? null,
  title: event.title,
  kind: event.kind ?? "assignment",
  label: event.label ?? "",
  due_at: event.at ?? null,
  done: Boolean(event.done),
  updated_at: event.updatedAt,
});

const toChat = (chat) => ({
  id: chat.id,
  unit_id: chat.unitId ?? null,
  title: chat.title ?? "New chat",
  updated_at: chat.updatedAt,
  messages: (chat.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.text ?? "",
    // The app keeps source titles; the server takes whatever JSON it is given
    // and hands the same back, so nothing has to be flattened or parsed.
    sources: message.sources?.length ? message.sources : null,
    created_at: message.at,
  })),
});

/** `08:00` is what the app stores; the server wants a time, so seconds go on. */
function withSeconds(value) {
  const text = String(value ?? "00:00");
  return text.length === 5 ? `${text}:00` : text;
}

// --- Inbound ----------------------------------------------------------------

const fromUnit = (row) => ({
  id: row.id,
  code: row.code,
  title: row.title,
  lecturer: row.lecturer ?? "",
  createdAt: row.updated_at,
  updatedAt: row.updated_at,
});

const fromSession = (row) => ({
  id: row.id,
  unitId: row.unit_id,
  day: row.weekday,
  start: String(row.starts_at).slice(0, 5),
  end: String(row.ends_at).slice(0, 5),
  room: row.room ?? "",
  updatedAt: row.updated_at,
});

const fromMaterial = (row, existing) => ({
  id: row.id,
  unitId: row.unit_id,
  title: row.title,
  body: row.body ?? "",
  kind: row.kind ?? "note",
  // The bytes live in a private bucket reached through a signed URL minted per
  // request, so the server has no durable link to send. The one this device
  // already has is kept — it is what draws the thumbnail on a photo of a page,
  // and dropping it would make the picture vanish on the next sync. A phone
  // that has never seen the file has null here and opens it through a fresh
  // signed URL instead.
  uri: existing?.uri ?? null,
  filename: existing?.filename,
  mimeType: existing?.mimeType,
  archived: Boolean(row.archived),
  addedAt: row.updated_at,
  updatedAt: row.updated_at,
  pageCount: row.page_count ?? null,
  uploadStatus: row.extraction_status === "done" ? "ready" : row.extraction_status,
});

const fromEvent = (row) => ({
  id: row.id,
  unitId: row.unit_id ?? null,
  title: row.title,
  at: row.due_at,
  kind: row.kind ?? "assignment",
  label: row.label ?? "",
  done: Boolean(row.done),
  createdAt: row.updated_at,
  updatedAt: row.updated_at,
});

const fromChat = (row) => ({
  id: row.id,
  unitId: row.unit_id ?? null,
  title: row.title ?? "New chat",
  mode: "ask",
  createdAt: row.updated_at,
  updatedAt: row.updated_at,
  messages: (row.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role,
    text: message.content ?? "",
    sources: message.sources ?? undefined,
    at: message.created_at,
  })),
});

/**
 * Folds a page of server rows into a cached table.
 *
 * Tombstones drop the row; everything else replaces the local copy, because
 * the pull only ever carries rows the server considers newer than the cursor
 * the device sent. The local row is handed to the converter so it can keep the
 * few fields that are true of this handset rather than of the account — a
 * file's on-device URI being the one that matters.
 */
function merge(local, rows, convert, { newestFirst = false } = {}) {
  if (!rows?.length) return local;

  const byId = new Map(local.map((row) => [row.id, row]));

  for (const row of rows) {
    if (row.deleted_at) byId.delete(row.id);
    else byId.set(row.id, convert(row, byId.get(row.id)));
  }

  const merged = [...byId.values()];

  // Materials and chats read newest first everywhere they are shown; the rest
  // keep the order they were added in.
  return newestFirst
    ? merged.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    : merged;
}

// --- The round trip ---------------------------------------------------------

/**
 * Pushes local changes, then pulls whatever the server has that this device
 * does not. Safe to call on launch, on foreground, and after any write.
 *
 * Returns `{ error }`. Never throws: this runs from effects and from button
 * handlers, and a rejected promise in either is a crashed screen.
 */
export async function sync({ force = false } = {}) {
  const state = useStudyStore.getState();

  if (!state.isAuthenticated) return { error: null };

  // One at a time. Two overlapping syncs would push the same rows twice and
  // race each other's cursor, which is how a cursor ends up ahead of the data.
  if (state.syncing && !force) return { error: null };

  const store = useStudyStore.getState();
  store.setSyncing(true);

  try {
    const push = await pushChanges(state);

    if (push.error) {
      store.setSyncError(push.error);
      return { error: push.error };
    }

    // Cleared by id, so an edit made while the request was in flight survives
    // and goes next time. The pull cursor deliberately does not move here: the
    // cursor a push returns is the server's "now", and pulling from it would
    // skip everything another device wrote since the last pull.
    if (push.sent) store.markPushed(push.sent);

    const pull = await pullChanges(useStudyStore.getState().syncCursor);

    if (pull.error) {
      store.setSyncError(pull.error);
      return { error: pull.error };
    }

    store.setSyncError(null);
    return { error: null };
  } finally {
    useStudyStore.getState().setSyncing(false);
  }
}

async function pushChanges(state) {
  const { tombstones } = state;

  const payload = {
    units: [
      ...dirty(state.units).map(toUnit),
      ...tombstones.units.map((entry) => grave({ code: "", title: "" }, entry)),
    ],
    class_sessions: [
      ...dirty(state.sessions).map(toSession),
      ...filed(tombstones.sessions).map((entry) =>
        grave(
          {
            unit_id: entry.unitId,
            weekday: 0,
            starts_at: "00:00:00",
            ends_at: "00:00:00",
          },
          entry,
        ),
      ),
    ],
    materials: [
      ...dirty(state.materials).map(toMaterial),
      ...filed(tombstones.materials).map((entry) =>
        grave({ unit_id: entry.unitId, title: "" }, entry),
      ),
    ],
    events: [
      ...dirty(state.events).map(toEvent),
      // An event needs no unit — not everything a student has to turn up for
      // belongs to one — so its tombstone is never dropped.
      ...tombstones.events.map((entry) =>
        grave({ unit_id: entry.unitId ?? null, title: "" }, entry),
      ),
    ],
    chats: [
      ...dirty(state.chats).map(toChat),
      ...tombstones.chats.map((entry) => grave({}, entry)),
    ],
  };

  const nothingToSay = Object.values(payload).every((rows) => rows.length === 0);
  if (nothingToSay) return { error: null, sent: null };

  const { error } = await authed((token) => coursework.push(payload, token));
  if (error) return { error, sent: null };

  // Exactly what went, so the store clears exactly that and nothing written
  // since. The version matters as much as the id: a note edited while the
  // request was in flight is a *different* row from the one that was sent, and
  // clearing it by id alone would drop that edit on the floor — the note would
  // appear to save and then quietly un-save itself.
  const versions = (rows) => new Map(rows.map((row) => [row.id, row.updated_at]));
  const ids = (rows) => new Set(rows.map((row) => row.id));

  return {
    error: null,
    sent: {
      units: versions(payload.units),
      sessions: versions(payload.class_sessions),
      materials: versions(payload.materials),
      events: versions(payload.events),
      chats: versions(payload.chats),
      // Every tombstone clears, including the ones `filed` held back. Those
      // can never be sent — the server never had the row — so keeping them
      // would leave the outbox permanently non-empty and every screen that
      // asks "is anything waiting" permanently wrong.
      graves: {
        units: ids(tombstones.units),
        sessions: ids(tombstones.sessions),
        materials: ids(tombstones.materials),
        events: ids(tombstones.events),
        chats: ids(tombstones.chats),
      },
    },
  };
}

/**
 * Tombstones the push could actually carry.
 *
 * One for a row filed under a unit needs that unit's id — the server validates
 * a burial against the same schema as a live row. Anything missing it was
 * created and deleted between two syncs, so the server never had it and there
 * is nothing to bury.
 */
const filed = (entries) => entries.filter((entry) => entry.unitId);

async function pullChanges(since) {
  let cursor = since;
  let guard = 0;

  // The server pages a large pull and says so. Looping here rather than
  // leaving it to the next launch is what stops a student who has been offline
  // for a fortnight seeing half their material come back.
  while (guard < 10) {
    guard += 1;

    const { data, error } = await authed((token) => coursework.pull(cursor, token));
    if (error) return { error };

    const state = useStudyStore.getState();

    state.applyPull({
      units: merge(state.units, data.units, fromUnit),
      sessions: merge(state.sessions, data.class_sessions, fromSession),
      materials: merge(state.materials, data.materials, fromMaterial, {
        newestFirst: true,
      }),
      events: merge(state.events, data.events, fromEvent),
      chats: merge(state.chats, data.chats, fromChat, { newestFirst: true }),
    });

    cursor = data.cursor ?? cursor;
    state.setCursor(cursor);

    if (!data.has_more) break;
  }

  return { error: null };
}
