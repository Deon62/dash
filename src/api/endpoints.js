import { api, isBackendConfigured } from "@/api/client";

/**
 * Every call the app will need, named and typed by its shape.
 *
 * Written before the server exists on purpose: this is the contract, and
 * having it in one file is what lets the backend be built against something
 * concrete instead of guessed at from screen code.
 *
 * Each function is a one-liner over `api`. The value is the list, not the code.
 */

// --- Account ---------------------------------------------------------------

export const account = {
  /** Sends a real OTP. Replaces the local stub in `src/lib/auth.js`. */
  requestOtp: (phone) => api.post("/auth/otp", { phone }),
  verifyOtp: (phone, code) => api.post("/auth/otp/verify", { phone, code }),
  signInWithGoogle: (idToken) => api.post("/auth/google", { idToken }),

  me: (token) => api.get("/me", { token }),
  updateProfile: (patch, token) => api.patch("/me", patch, { token }),
  deleteAccount: (token) => api.delete("/me", { token }),
};

// --- Coursework ------------------------------------------------------------

/**
 * Sync is a push of what changed, then a pull of what the server has.
 *
 * Ids come from the device, so `push` is safe to retry: the server upserts on
 * the id it is given rather than minting its own.
 */
export const coursework = {
  push: (payload, token) => api.post("/sync", payload, { token }),
  pull: (since, token) => api.get(`/sync?since=${encodeURIComponent(since ?? "")}`, { token }),

  /**
   * Uploads a PDF or image and asks the server to extract its text.
   *
   * This is the call that turns `totalPdfPagesPool`, `maxSingleFilePages` and
   * the OCR limits from advertised numbers into enforced ones — none of them
   * can be checked on the device, because nothing here can read a PDF.
   */
  uploadMaterial: (form, token) =>
    api.post("/materials/upload", form, { token }),
};

// --- The tutor -------------------------------------------------------------

export const tutor = {
  /**
   * Asks a model, grounded in the student's own material.
   *
   * `passages` is what `src/lib/tutor.js` already produces — the retrieval half
   * is done on the device, so the server only has to generate. Sending the
   * ranked passages rather than the whole corpus is also what keeps a request
   * small enough to answer on a phone connection.
   */
  ask: ({ question, passages, unitCode }, token) =>
    api.post("/tutor/ask", { question, passages, unitCode }, { token }),

  quiz: ({ passages, count }, token) =>
    api.post("/tutor/quiz", { passages, count }, { token }),
};

// --- Billing ---------------------------------------------------------------

export const billing = {
  /** The authoritative subscription. The device's copy is only a cache. */
  subscription: (token) => api.get("/billing/subscription", { token }),

  /**
   * Confirms a Paystack payment server-side.
   *
   * Until this exists, activation is the student's word — the app cannot see a
   * charge, and `newSubscription` marks anything paid as `verified: false` for
   * exactly this reason.
   */
  verifyPayment: (reference, token) =>
    api.post("/billing/verify", { reference }, { token }),

  // --- Friends: one payment, five seats -----------------------------------

  /** Creates the group the payer owns. */
  createGroup: (token) => api.post("/billing/group", {}, { token }),

  /** A shareable code or link the payer sends to the other four. */
  inviteCode: (token) => api.get("/billing/group/invite", { token }),

  /** Who is on the plan, so seats can be shown and freed. */
  members: (token) => api.get("/billing/group/members", { token }),

  join: (code, token) => api.post("/billing/group/join", { code }, { token }),
  removeMember: (memberId, token) =>
    api.delete(`/billing/group/members/${memberId}`, { token }),
};

export { isBackendConfigured };
