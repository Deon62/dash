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
  verifyOtp: (phone, code, { deviceId, platform, appVersion, referralCode } = {}) =>
    api.post(v1("/auth/otp/verify"), {
      phone,
      code,
      device_id: deviceId,
      platform,
      app_version: appVersion,
      // Read only when this request creates the account, and ignored — never
      // refused — when it is unknown. A student mistyping a friend's code must
      // still end up with an account.
      ...(referralCode ? { referral_code: referralCode } : {}),
    }),

  signInWithGoogle: (idToken, { deviceId, platform, appVersion, referralCode } = {}) =>
    api.post(v1("/auth/google"), {
      id_token: idToken,
      device_id: deviceId,
      platform,
      app_version: appVersion,
      ...(referralCode ? { referral_code: referralCode } : {}),
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

  /**
   * Fires a notification at every device on the account, now, ignoring quiet
   * hours. Answers `{ delivered, has_devices }` — read together, those two
   * tell apart "no token was ever registered" from "a token is stored and Expo
   * refused it", which are different problems with the same symptom.
   *
   * Nothing in the app calls it. The control that did was removed from
   * Settings — a build a student installs should have no test buttons in it —
   * and the route is listed here because the server still serves it, which is
   * what this file is a record of.
   */
  pushTest: (token) => api.post(v1("/me/push/test"), {}, { token }),

  /**
   * What the server has sent, newest first.
   *
   * Push is fire-and-forget — a reminder that arrives while the phone is off is
   * simply gone — so this is the only way a student sees one they missed.
   */
  notifications: (limit, token) =>
    api.get(v1(`/me/notifications?limit=${limit}`), { token }),

  /**
   * `today` is the student's *local* day, and is not optional in practice.
   *
   * Without it the server dates the read in UTC while `recordStudyDay` below
   * stores a local day, so the two endpoints disagree about what day it is for
   * anyone not on UTC. That read a live streak as zero.
   */
  streak: (day, token) =>
    api.get(v1(`/me/streak?today=${encodeURIComponent(day)}`), { token }),
  recordStudyDay: (day, token) => api.post(v1("/me/streak"), { day }, { token }),

  /** What is left of this month's allowances, counted server-side. */
  usage: (token) => api.get(v1("/me/usage"), { token }),

  /**
   * The referral code and what it has earned.
   *
   * The first call to this is what mints the code, so it is asked for on the
   * screen that shows one rather than on launch. Counts, not people: the
   * payload names nobody, and there is no route that does.
   */
  referrals: (token) => api.get(v1("/me/referrals"), { token }),

  /**
   * One idea from one student. Write-only, on purpose.
   *
   * There is no `GET` — the route 405s — because a list of your own requests
   * has one honest state, a paragraph with no answer beside it, and that reads
   * as being ignored rather than as being heard. `201` carries the wording for
   * the confirmation, so the copy can change without a release.
   *
   * `app_version` and `platform` are unvalidated and untrusted. They are there
   * so "the timetable is empty" can be read against the build it came from.
   */
  featureRequest: ({ body, appVersion, platform }, token) =>
    api.post(
      v1("/me/feature-requests"),
      {
        body,
        ...(appVersion ? { app_version: appVersion } : {}),
        ...(platform ? { platform } : {}),
      },
      { token },
    ),
};

// --- The build itself -------------------------------------------------------

export const release = {
  /**
   * Is this build out of date, and is it too old to keep running?
   *
   * Unauthenticated, deliberately, and that is not an oversight to tidy up
   * later. The build most likely to need forcing off the network is one that is
   * broken, and broken often means it cannot sign in — a check behind a token
   * cannot reach the phones that need it most. Nothing in the answer is
   * user-specific, so there is nothing to leak.
   *
   * `version` is the *store* version of the installed binary, never the OTA
   * update id. The question this asks is which binary is running, and only an
   * install from the store changes that.
   *
   * Answers `{ latest_version, update_available, update_required, store_url,
   * notes, minimum_version }`. An empty release table answers "no update" to
   * everybody, which is the right default: the failure worth designing out is
   * an update prompt that appears because nothing has been recorded yet.
   */
  check: ({ platform, version }) =>
    api.get(
      v1(
        `/app/release?platform=${encodeURIComponent(platform)}` +
          `&version=${encodeURIComponent(version ?? "")}`,
      ),
    ),
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
   * Starts an M-Pesa payment. The one nearly every student uses.
   *
   * `phone` is sent **exactly as the student typed it**. `0712…`, `+254712…`,
   * `254 712 345 678`, spaced, hyphenated — the server normalises all of them
   * and refuses only a number that genuinely cannot receive a prompt, with a
   * message written for a student. Validating the format in the app instead
   * means refusing numbers that would have worked.
   *
   * **There is no amount.** The price is read from the server's plan table,
   * because a price the client can influence is a price the client can choose.
   *
   * Answers `{ mode, reference, message, phone, amount_ksh, checkout_url }`.
   * Branch on `mode`: `stk` means a PIN prompt is ringing and the app should
   * poll `mpesaStatus`; `redirect` means M-Pesa was unreachable and the server
   * opened a fallback page, which is handled exactly like a card payment.
   */
  mpesa: (tier, phone, token) =>
    api.post(v1("/billing/mpesa"), { tier, phone }, { token }),

  /**
   * Where an STK payment has got to.
   *
   * Answers `{ status, message, pending, subscription }`. **Poll on `pending`,
   * never on `status`** — they disagree in the one case that matters, where a
   * slow answer from Safaricom comes back `pending: true` and must keep the
   * spinner up rather than drawing as a failure to somebody mid-PIN.
   *
   * `subscription` arrives with the success, so the screen does not have to
   * make a second call at the one moment the student is watching it.
   */
  mpesaStatus: (reference, token) =>
    api.get(
      v1(`/billing/mpesa/status?reference=${encodeURIComponent(reference)}`),
      { token },
    ),

  /**
   * Starts a card payment. Answers `{ checkout_url, reference }`.
   *
   * Open the URL, and call `verifyPayment` when the browser closes — **for any
   * reason at all**, including what looks like a cancellation. There is no
   * webhook for this account (the Paystack dashboard is shared with another
   * product and must not be touched), so that call is the settlement path
   * rather than a confirmation step. Skip it and the payment settles only when
   * a server-side sweep notices, minutes later, with the student sitting on a
   * screen that has not changed.
   *
   * `503` means card payments are not configured. Point at M-Pesa.
   */
  card: (tier, token) => api.post(v1("/billing/card"), { tier }, { token }),

  /**
   * The Kora checkout. Superseded by `mpesa` and `card` above.
   *
   * Kept because a build already on a phone still calls it and this file is a
   * record of what the server serves — not because anything here should reach
   * for it. Nothing in the app does any more.
   */
  checkout: (tier, token) => api.post(v1("/billing/checkout"), { tier }, { token }),

  /**
   * Confirms a payment server-side.
   *
   * Safe to call repeatedly — the reference is unique, so a second call
   * returns the same subscription rather than extending it again. There is no
   * webhook on this account, so this call is what makes a card payment true —
   * a server-side sweep is the backstop for the ones the app never sees.
   */
  /**
   * Settles a card payment. **Never an M-Pesa reference** — that answers `409`
   * and points at `mpesaStatus`, because the two providers do not know each
   * other's references and asking the wrong one reports "no such transaction",
   * which reaches a just-charged student as "your payment did not go through".
   */
  verifyPayment: (reference, token) =>
    api.post(v1("/billing/verify"), { reference }, { token }),

  // --- Friends: one payment, six seats ------------------------------------

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
