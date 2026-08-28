import { API_V1, api, isBackendConfigured } from "@/api/client";

/**
 * Every call the app makes to the server, named and shaped by its endpoint.
 *
 * This mirrors the deployed contract exactly — the paths, the field names and
 * the casing are the server's, not the app's. The server speaks `snake_case`
 * and that is left alone here rather than translated: a mapping layer in the
 * middle is one more place for a field to be renamed on one side only.
 *
 * Each function is a one-liner over `api`. The value is the list, not the code.
 */

/** Version prefix in one place, so a bump is one edit rather than twenty. */
const v1 = (path) => `${API_V1}${path}`;

// --- Account ---------------------------------------------------------------

export const account = {
  /** Texts a six-digit code. The response never says whether an account exists. */
  requestOtp: (phone) => api.post(v1("/auth/otp"), { phone }),

  /**
   * `deviceId` is not optional in practice.
   *
   * The server allows one live session per account and checks it on every
   * request. A token issued without a device id is never invalidated when the
   * student signs in elsewhere, which is exactly the hole a paid account gets
   * shared through.
   */
  verifyOtp: (phone, code, { deviceId, platform, appVersion } = {}) =>
    api.post(v1("/auth/otp/verify"), {
      phone,
      code,
      device_id: deviceId,
      platform,
      app_version: appVersion,
    }),

  signInWithGoogle: (idToken, { deviceId, platform, appVersion } = {}) =>
    api.post(v1("/auth/google"), {
      id_token: idToken,
      device_id: deviceId,
      platform,
      app_version: appVersion,
    }),

  /** Access tokens last half an hour; this is what keeps a session alive. */
  refresh: (refreshToken) =>
    api.post(v1("/auth/refresh"), { refresh_token: refreshToken }),

  signOut: (deviceId, token) =>
    api.post(v1("/auth/logout"), { device_id: deviceId }, { token }),

  me: (token) => api.get(v1("/me"), { token }),
  updateProfile: (patch, token) => api.patch(v1("/me"), patch, { token }),
  deleteAccount: (token) => api.delete(v1("/me"), { token }),

  /**
   * The profile photo, in the same three steps as a material: sign, PUT the
   * bytes straight at Supabase Storage, confirm.
   *
   * `avatar_path` is not settable through `updateProfile`. It names an object
   * in a private bucket, so the server takes it only here, where it checks the
   * path belongs to the caller before storing it.
   */
  avatarUploadUrl: ({ mimeType, byteSize }, token) =>
    api.post(
      v1("/me/avatar/upload-url"),
      { mime_type: mimeType, byte_size: byteSize },
      { token },
    ),

  confirmAvatar: (path, token) => api.post(v1("/me/avatar"), { path }, { token }),

  /** A signed URL that expires. Fetched when the profile loads, never stored. */
  avatarUrl: (token) => api.get(v1("/me/avatar-url"), { token }),

  removeAvatar: (token) => api.delete(v1("/me/avatar"), { token }),

  settings: (token) => api.get(v1("/me/settings"), { token }),
  updateSettings: (patch, token) => api.patch(v1("/me/settings"), patch, { token }),

  /** Registers this handset for push. Idempotent — it is a PUT on the id. */
  registerDevice: (device, token) => api.put(v1("/me/devices"), device, { token }),
  forgetDevice: (deviceId, token) =>
    api.delete(v1(`/me/devices/${deviceId}`), { token }),

  streak: (token) => api.get(v1("/me/streak"), { token }),
  recordStudyDay: (day, token) => api.post(v1("/me/streak"), { day }, { token }),

  /** What is left of today's allowances, counted server-side. */
  usage: (token) => api.get(v1("/me/usage"), { token }),
};

// --- Coursework ------------------------------------------------------------

/**
 * Sync is a push of what changed, then a pull of what the server has.
 *
 * Ids come from the device, so `push` is safe to retry: the server upserts on
 * the id it is given rather than minting its own.
 */
export const coursework = {
  push: (payload, token) => api.post(v1("/sync"), payload, { token }),
  pull: (since, token) =>
    api.get(v1(`/sync?since=${encodeURIComponent(since ?? "")}`), { token }),
};

// --- Materials -------------------------------------------------------------

/**
 * Files never pass through the API.
 *
 * Upload is three steps: ask for a signed URL, PUT the bytes straight at
 * Supabase Storage, then tell the server it landed. Routing a 50MB PDF through
 * the API instead would hold a worker for the length of the upload, and the
 * free instance has one.
 */
export const materials = {
  uploadUrl: ({ materialId, unitId, kind, filename, mimeType, byteSize }, token) =>
    api.post(
      v1("/materials/upload-url"),
      {
        material_id: materialId,
        unit_id: unitId,
        kind,
        filename,
        mime_type: mimeType,
        byte_size: byteSize,
      },
      { token },
    ),

  /** Called after the bytes are in the bucket. This is what starts extraction. */
  completeUpload: ({ materialId, title }, token) =>
    api.post(v1("/materials/complete"), { material_id: materialId, title }, { token }),

  downloadUrl: (materialId, token) =>
    api.get(v1(`/materials/${materialId}/download-url`), { token }),
};

// --- Billing ---------------------------------------------------------------

export const billing = {
  /**
   * The plans, from the server. Public — no token, nothing to authorise.
   *
   * `src/theme/plans.js` ships its own copy so the app can refuse before
   * making a request; this is what lets a price change reach a phone without
   * an app store release. When they disagree, the server wins.
   */
  plans: () => api.get(v1("/billing/plans")),

  /** The authoritative subscription. The device's copy is only a cache. */
  subscription: (token) => api.get(v1("/billing/subscription"), { token }),

  /**
   * Opens a payment page for this student and this plan.
   *
   * The link comes from the server rather than being shipped in the app, and
   * that is the whole point: a fixed, shareable payment link is the same
   * page for everyone, so the charge it produces names no account. The server
   * initialises the transaction with the caller's user id in the metadata, so
   * the payment arrives already tied to a student — otherwise there is nothing
   * to reconcile against but an email most accounts do not have.
   *
   * Returns `{ checkout_url, reference }`. Open the URL, then hand the
   * reference to `verifyPayment` when the browser closes.
   *
   * `authorization_url` is also present and identical — the old name, kept by
   * the server for one release so a build already on a phone keeps working.
   * Read `checkout_url`.
   */
  checkout: (tier, token) => api.post(v1("/billing/checkout"), { tier }, { token }),

  /**
   * Confirms a payment server-side.
   *
   * Safe to call repeatedly — the reference is unique, so a second call
   * returns the same subscription rather than extending it again. Kora's
   * webhook is what makes a payment true; this is the fast path so a student
   * who has just paid does not wait on it.
   */
  verifyPayment: (reference, token) =>
    api.post(v1("/billing/verify"), { reference }, { token }),

  // --- Friends: one payment, five seats -----------------------------------

  /** Creates the group the payer owns. Only valid on a Friends plan. */
  createGroup: (token) => api.post(v1("/billing/group"), {}, { token }),

  /** The group, including the code the payer hands out. */
  group: (token) => api.get(v1("/billing/group"), { token }),

  /** Who is on the plan, so seats can be shown and freed. */
  members: (token) => api.get(v1("/billing/group/members"), { token }),

  join: (code, token) => api.post(v1("/billing/group/join"), { code }, { token }),
  removeMember: (memberId, token) =>
    api.delete(v1(`/billing/group/members/${memberId}`), { token }),
};

// --- The tutor -------------------------------------------------------------

/**
 * Retrieval happens on the server, not here.
 *
 * That is the point: deciding "your notes do not cover this" is only
 * trustworthy if the side holding all the material did the looking. The device
 * sends a question and a unit; the server ranks the student's own passages,
 * generates against them, and says which sources it used.
 *
 * `ask` is missing from this list on purpose — it streams server-sent events
 * rather than returning JSON, so it lives in `src/lib/tutor.js` where the
 * stream can be read frame by frame.
 */
export const tutor = {
  /** The model line-up, including the ones not switched on yet. */
  models: (token) => api.get(v1("/tutor/models"), { token }),

  /**
   * A multiple-choice quiz over one unit or one topic.
   *
   * Not streamed, unlike an answer: a quiz renders as cards and there is
   * nothing to show until the last question has been parsed and validated.
   */
  quiz: ({ topic, unitCode, count, model }, token) =>
    api.post(
      v1("/tutor/quiz"),
      { topic, unit_code: unitCode, count, model },
      { token },
    ),
};

export { isBackendConfigured };
