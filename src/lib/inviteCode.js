import * as Crypto from "expo-crypto";

/**
 * No I, O, 0 or 1.
 *
 * An invite code gets read aloud across a lecture hall and typed from a
 * screenshot, and those four characters are where that goes wrong. Matches the
 * server's alphabet exactly — a code generated here has to be one the backend
 * would also have produced.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

/**
 * A shareable code for a Friends group.
 *
 * Generated on the device only until the group endpoint is wired: the server
 * mints the real one, and a pull replaces this. It exists so the payer sees a
 * code the moment they pay rather than an empty screen waiting on a round trip
 * that cannot happen yet.
 *
 * `getRandomBytes` rather than `Math.random`, because an invite code that can
 * be guessed is a free seat.
 */
export function newInviteCode() {
  const bytes = Crypto.getRandomBytes(LENGTH);

  let code = "";
  for (let index = 0; index < LENGTH; index += 1) {
    code += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return code;
}
