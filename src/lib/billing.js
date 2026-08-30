import { billing as billingApi } from "@/api/endpoints";
import { authed } from "@/lib/session";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * The plan, the payment and the group, as the server sees them.
 *
 * Nothing on the device grants a plan. A payment is a fact the server
 * establishes — from Kora's webhook, or from verifying the reference when the
 * browser closes — and every screen here reads that answer rather than writing
 * one of its own. `src/lib/checkout.js` is the half that opens the payment
 * page; this is the half that says what happened afterwards.
 */

const fromSubscription = (row) => ({
  tier: row.tier,
  /** What it was sold as, so an ended plan can be named rather than guessed at. */
  nominalTier: row.nominal_tier ?? row.tier,
  planName: row.name,
  expiresAt: row.expires_at,
  daysRemaining: row.days_remaining,
  verified: Boolean(row.verified),
  seats: row.seats ?? 1,
  isExpired: Boolean(row.is_expired),
});

const fromGroup = (row, { members = [], meId = null } = {}) => ({
  id: row.id,
  inviteCode: row.invite_code,
  seats: row.seats,
  seatsTaken: row.seats_taken,
  expiresAt: row.expires_at,
  members: members.map((member) => ({
    id: member.user_id,
    name: member.full_name || "A friend",
    isOwner: Boolean(member.is_owner),
    isMe: meId ? member.user_id === meId : false,
  })),
});

/** The plans and their prices, from the server. Public — no session needed. */
export async function loadPlans() {
  const { data, error } = await billingApi.plans();
  if (error) return { plans: [], error };

  return {
    plans: (data ?? []).map((plan) => ({
      tier: plan.id,
      name: plan.name,
      priceKsh: plan.price_ksh,
      pricePerSeatKsh: plan.price_per_seat_ksh,
      durationDays: plan.duration_days,
      seats: plan.seats,
      /**
       * `focus` | `synapse` | `friends`, and `monthly` | `season`.
       *
       * The pair is what matches a plan to a card and to a side of the toggle.
       * Never parsed out of the id: the server sends both for exactly this
       * reason, and an id is a key, not a description.
       */
      family: plan.family ?? null,
      billingPeriod: plan.billing_period ?? null,
      /**
       * Both derived server-side, so the figure under a Season price and the
       * badge on the toggle cannot drift from the amount actually charged.
       * `saving_percent` is 0 on a monthly plan.
       */
      pricePerMonthKsh: plan.price_per_month_ksh ?? null,
      savingPercent: plan.saving_percent ?? 0,
    })),
    error: null,
  };
}

/** The authoritative subscription. The device's copy is only a cache of this. */
export async function loadSubscription() {
  const { data, error } = await authed((token) => billingApi.subscription(token));
  if (error) return { error };

  useStudyStore.getState().setSubscription(fromSubscription(data));
  return { error: null };
}

/**
 * The Friends group this account is on, with its seats.
 *
 * A 404 is not a failure: most accounts are not on a group plan, and treating
 * "you have no group" as an error would put a red line on the billing screen
 * of everybody who never bought one.
 */
export async function loadGroup() {
  const store = useStudyStore.getState();

  const { data, error, status } = await authed((token) => billingApi.group(token));

  if (error) {
    if (status === 404 || status === 403) {
      store.setGroup(null);
      return { error: null };
    }
    return { error };
  }

  const members = await authed((token) => billingApi.members(token));

  store.setGroup(
    fromGroup(data, {
      members: members.data ?? [],
      meId: store.userId,
    }),
  );

  return { error: null };
}

/** Creates the group a Friends payer owns, then reads it back with its code. */
export async function createGroup() {
  const { error } = await authed((token) => billingApi.createGroup(token));
  if (error) return { error };

  return loadGroup();
}

/**
 * Takes a seat on someone else's plan.
 *
 * The subscription is re-read rather than assumed: joining is what grants the
 * tier, and the server is the only side that knows whether there was a seat
 * left to take.
 */
export async function joinGroup(code) {
  const { error } = await authed((token) => billingApi.join(code, token));
  if (error) return { error };

  await loadSubscription();
  await loadGroup();

  return { error: null };
}

/** Frees a seat. Only the payer can, and the server enforces that. */
export async function removeMember(memberId) {
  const { error } = await authed((token) => billingApi.removeMember(memberId, token));
  if (error) return { error };

  return loadGroup();
}
