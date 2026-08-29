import { account as accountApi } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { refreshAvatarUrl } from "@/lib/avatar";
import { useStudyStore } from "@/store/useStudyStore";
import { dayKey } from "@/lib/dates";

/**
 * The account: profile, preferences, streak and meters.
 *
 * Each of these is small enough that a screen could call the endpoint itself.
 * They live here because the translation between what the server stores and
 * what the app shows — `full_name` against `name`, `class_reminders` against
 * `sessionReminders` — has to happen in exactly one place or the two drift and
 * a setting silently stops saving.
 */

// --- Profile ----------------------------------------------------------------

const fromProfile = (row) => ({
  name: row.full_name ?? "",
  email: row.email ?? "",
  phone: row.phone ?? null,
  institution: row.institution ?? "",
  program: row.program ?? "",
  yearOfStudy: row.year_of_study ?? null,
  semester: row.semester ?? null,
  avatarPath: row.avatar_path ?? null,
  memberSince: row.created_at ? String(new Date(row.created_at).getFullYear()) : "",
});

const toProfile = (patch) => {
  const body = {};
  if (patch.name !== undefined) body.full_name = patch.name;
  if (patch.email !== undefined) body.email = patch.email || null;
  if (patch.institution !== undefined) body.institution = patch.institution;
  if (patch.program !== undefined) body.program = patch.program;
  if (patch.yearOfStudy !== undefined) body.year_of_study = patch.yearOfStudy;
  if (patch.semester !== undefined) body.semester = patch.semester;
  // `avatar_path` is deliberately absent. It names an object in a private
  // bucket, and the server refuses to take it here for that reason — a client
  // free to write it could name somebody else's file and then read it back
  // through the signed URL. `src/lib/avatar.js` sets it, via POST /me/avatar.
  return body;
};

/** Reads the profile, and the subscription that comes with it. */
export async function loadProfile() {
  const { data, error } = await authed((token) => accountApi.me(token));
  if (error) return { error };

  const store = useStudyStore.getState();
  store.applyServerProfile(fromProfile(data));

  // A name on the account means intake was completed, on this phone or another
  // one. Without this a returning student is sent back through it on every new
  // device, which reads as their details having been lost.
  if (data.full_name) store.setOnboarded(true);

  // The photo is stored as a path and displayed as a signed URL that expires,
  // so the URL is fetched fresh here rather than kept. Not awaited: an image
  // arriving a moment after the name is fine, and a slow storage call must not
  // hold up the screen that is waiting on this.
  refreshAvatarUrl();

  if (data.subscription) {
    store.setSubscription({
      tier: data.subscription.tier,
      startedAt: data.subscription.started_at,
      expiresAt: data.subscription.expires_at,
      verified: Boolean(data.subscription.verified),
    });
  }

  return { error: null };
}

/**
 * Saves a change to the profile, locally first.
 *
 * Written to the store before the request so the screen it was typed on can
 * close immediately. A failure is reported; it does not roll the field back,
 * because the next sync pushes it again and silently undoing something a
 * student typed is worse than showing it saved a moment early.
 */
export async function saveProfile(patch) {
  useStudyStore.getState().updateProfile(patch);

  const { data, error } = await authed((token) =>
    accountApi.updateProfile(toProfile(patch), token),
  );

  if (error) return { error };

  useStudyStore.getState().applyServerProfile(fromProfile(data));
  return { error: null };
}

/**
 * Deletes the account on the server, then clears the handset.
 *
 * In that order deliberately: wiping locally first would leave no token to
 * authenticate the deletion with, and the account would live on with nobody
 * able to reach it.
 */
export async function deleteAccount() {
  const { error } = await authed((token) => accountApi.deleteAccount(token));
  if (error) return { error };

  useStudyStore.getState().resetEverything();
  return { error: null };
}

// --- Preferences ------------------------------------------------------------

const fromSettings = (row) => ({
  deadlineReminders: Boolean(row.deadline_reminders),
  // The server still calls these class reminders; the app calls them sessions,
  // because a postgraduate attends seminars and supervisions rather than
  // classes. One rename, one place.
  sessionReminders: Boolean(row.class_reminders),
  biometricLock: Boolean(row.biometric_lock),
  reminderLeadMinutes: row.reminder_lead_minutes,
  quietHoursStart: row.quiet_hours_start,
  quietHoursEnd: row.quiet_hours_end,
  timezone: row.timezone,
});

const toSettings = (patch) => {
  const body = {};
  if (patch.deadlineReminders !== undefined) {
    body.deadline_reminders = patch.deadlineReminders;
  }
  if (patch.sessionReminders !== undefined) {
    body.class_reminders = patch.sessionReminders;
  }
  if (patch.biometricLock !== undefined) body.biometric_lock = patch.biometricLock;
  if (patch.reminderLeadMinutes !== undefined) {
    body.reminder_lead_minutes = patch.reminderLeadMinutes;
  }
  return body;
};

export async function loadSettings() {
  const { data, error } = await authed((token) => accountApi.settings(token));
  if (error) return { error };

  useStudyStore.getState().applyServerSettings(fromSettings(data));
  return { error: null };
}

/**
 * Saves a preference.
 *
 * The timezone rides along on every write. It is the load-bearing setting for
 * reminders — without it the server cannot know when 22:00 is for this person
 * — and a student who travels would otherwise keep an old one for good.
 */
export async function saveSettings(patch) {
  useStudyStore.getState().updateSettings(patch);

  const body = toSettings(patch);
  const timezone = deviceTimezone();
  if (timezone) body.timezone = timezone;

  const { data, error } = await authed((token) =>
    accountApi.updateSettings(body, token),
  );

  if (error) return { error };

  useStudyStore.getState().applyServerSettings(fromSettings(data));
  return { error: null };
}

/**
 * Sends the handset's timezone and nothing else.
 *
 * `saveSettings` already carries it, but only when a student changes a
 * preference — and most never do, so the server was left with whatever it had
 * defaulted to. Reminders are wall-clock promises: a session stored as
 * "Tuesdays at 08:00" has no zone of its own, and neither do quiet hours. An
 * unrecognised name falls back to UTC on the server rather than refusing to
 * notify, which makes a wrong zone a quiet three-hour error instead of a
 * crash — the kind of bug nobody reports and everybody suffers.
 *
 * Called from `refreshAccount` on every full launch. Cheap, idempotent, and
 * silent: nothing on screen depends on it.
 */
export async function pushTimezone() {
  const timezone = deviceTimezone();
  if (!timezone) return { error: null };

  const { error } = await authed((token) =>
    accountApi.updateSettings({ timezone }, token),
  );

  return { error: error ?? null };
}

function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

// --- Streak -----------------------------------------------------------------

export async function loadStreak() {
  const { data, error } = await authed((token) =>
    accountApi.streak(dayKey(), token),
  );
  if (error) return { error };

  useStudyStore.getState().applyServerStreak({
    current: data.current,
    longest: data.longest,
    lastDay: data.last_day ?? null,
    // The server sends the days of the current week, which is exactly what the
    // streak screen draws. Anything further back is a number, not a calendar.
    days: data.this_week ?? undefined,
  });

  return { error: null };
}

/**
 * Marks today as studied.
 *
 * The *local* day, not a UTC one: deriving it from a timestamp breaks the
 * streak of anyone revising after three in the morning, which is exactly this
 * audience. Idempotent server-side, so it can be called on every question
 * without counting first.
 */
export async function recordStudyDay() {
  useStudyStore.getState().recordStudy();

  const { data, error } = await authed((token) =>
    accountApi.recordStudyDay(dayKey(), token),
  );

  if (error) return { error };

  useStudyStore.getState().applyServerStreak({
    current: data.current,
    longest: data.longest,
    lastDay: data.last_day ?? null,
    // The server sends the days of the current week, which is exactly what the
    // streak screen draws. Anything further back is a number, not a calendar.
    days: data.this_week ?? undefined,
  });

  return { error: null };
}

// --- Meters -----------------------------------------------------------------

/**
 * What the plan allows and how much is gone, counted server-side.
 *
 * The device keeps its own tally so a limit can be refused with no connection,
 * but these are the numbers that decide, and they are what the Usage screen
 * draws whenever they are present.
 */
export async function loadUsage() {
  const { data, error } = await authed((token) => accountApi.usage(token));
  if (error) return { error };

  const meter = (row) => ({
    used: row?.used ?? 0,
    limit: row?.limit ?? 0,
    unlimited: Boolean(row?.unlimited),
  });

  useStudyStore.getState().applyServerUsage({
    tier: data.tier,
    planName: data.plan_name,
    aiQueriesToday: meter(data.ai_queries_today),
    // Only the free plan sets one. It arrives as unlimited on every paid tier,
    // and `UsageMeter` is not drawn for it there.
    aiQueriesTotal: meter(data.ai_queries_total),
    quizzes: meter(data.quizzes),
    quizInterval: data.quiz_interval,
    courseUnits: meter(data.course_units),
    ocrPages: meter(data.ocr_pages_this_month),
  });

  return { error: null };
}
