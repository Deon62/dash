/**
 * Local, offline stand-in for the real auth provider.
 *
 * Nothing here talks to a server. The phone screen asks for a code, this
 * accepts any six digits, and the store mints a local user id — enough to build
 * and demo every screen behind the sign-in wall while the backend is being
 * decided. Swapping in a real provider means changing these two functions and
 * nothing else: both already return `{ error }` rather than throwing, because
 * they are called straight from button handlers.
 */

const CODE_LENGTH = 6;

/** A believable pause, so the button's busy state is visible rather than a flicker. */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pretends to text a code. `phone` is full E.164, e.g. +254712345678. */
export async function sendPhoneOtp(phone) {
  if (!phone) return { error: "Enter a mobile number first." };
  await delay(450);
  return {};
}

/**
 * Accepts any six digits while auth is disconnected.
 *
 * The length check stays because it is the one piece of real feedback the
 * screen can still give — an empty or half-typed code is a mistake either way.
 */
export async function verifyPhoneOtp(phone, token) {
  await delay(450);

  if (!/^\d{6}$/.test(String(token ?? ""))) {
    return { error: `Enter the ${CODE_LENGTH}-digit code.` };
  }

  return {};
}

/**
 * Google, also local for now.
 *
 * Returns a placeholder address rather than opening a browser: with no OAuth
 * client configured there is nothing on the other side of that redirect, and a
 * consent screen that cannot complete is worse than an obvious stand-in.
 */
export async function signInWithGoogle() {
  await delay(600);
  return { email: "student@example.com" };
}
