import * as Crypto from "expo-crypto";

/**
 * Client-generated ride ids.
 *
 * The id is minted on the phone, not by the server, and that is what makes the
 * outbox safe: the same ride can be pushed any number of times and stays one
 * row, because the upsert matches on this id. A server default would turn every
 * retry into a duplicate ride.
 *
 * `crypto.randomUUID()` is not available in Hermes, hence expo-crypto.
 */
export function newId() {
  return Crypto.randomUUID();
}
