/**
 * Deterministic mock ride history.
 *
 * Generated rather than hand-listed so the charts have a year of plausible
 * data to plot — a handful of rides leaves the trend line mostly at zero. The
 * seed is fixed, so every launch produces the same history; swap this whole
 * module for the real data source when trip persistence lands.
 */

const SEED = 20260809;

/** Small LCG — deterministic, and good enough for shaping fake data. */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const MODE_WEIGHTS = [
  { key: "matatu", weight: 0.5 },
  { key: "boda", weight: 0.25 },
  { key: "tuktuk", weight: 0.15 },
  { key: "other", weight: 0.1 },
];

const PROFILES = {
  matatu: { minutes: [26, 55], km: [7, 15], fare: [50, 120] },
  boda: { minutes: [7, 18], km: [2, 5], fare: [100, 220] },
  tuktuk: { minutes: [10, 22], km: [3, 6], fare: [150, 260] },
  other: { minutes: [22, 55], km: [7, 19], fare: [150, 700] },
};

const ROUTES = {
  matatu: [
    "Route 46 · Kawangware → CBD",
    "Route 111 · Ngong → CBD",
    "Route 58 · Buruburu → CBD",
    "Route 33 · Embakasi → CBD",
    "Route 24 · South B → CBD",
  ],
  boda: [
    "CBD → Upper Hill",
    "CBD → Ngara",
    "Home → Junction Mall",
    "Westlands → Parklands",
  ],
  tuktuk: [
    "Upper Hill → Kilimani",
    "Kilimani → Yaya",
    "Adams Arcade → Home",
  ],
  other: [
    "Commuter rail · Syokimau → CBD",
    "Rideshare · Westlands → Home",
    "Rideshare · Airport → CBD",
  ],
};

function pickMode(random) {
  const roll = random();
  let cumulative = 0;
  for (const mode of MODE_WEIGHTS) {
    cumulative += mode.weight;
    if (roll <= cumulative) return mode.key;
  }
  return "matatu";
}

const between = (random, [min, max]) => min + random() * (max - min);

/** Newest first, spanning `days` back from now. */
export function generateRides(days = 365) {
  const random = makeRandom(SEED);
  const rides = [];
  const now = Date.now();

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const date = new Date(now - dayOffset * 86400000);
    const weekday = date.getDay();

    // Commuting is a weekday habit; weekends are sparser.
    const chance = weekday === 0 || weekday === 6 ? 0.3 : 0.85;
    if (random() > chance) continue;

    const legs = random() > 0.45 ? 2 : 1;

    for (let leg = 0; leg < legs; leg++) {
      const vehicleType = pickMode(random);
      const profile = PROFILES[vehicleType];
      const pool = ROUTES[vehicleType];

      // Morning leg out, evening leg back.
      const hour = leg === 0 ? 6 + Math.floor(random() * 3) : 16 + Math.floor(random() * 4);
      const startTime = new Date(date);
      startTime.setHours(hour, Math.floor(random() * 60), 0, 0);

      rides.push({
        id: `r-${dayOffset}-${leg}`,
        vehicleType,
        route: pool[Math.floor(random() * pool.length)],
        startTime,
        durationMin: Math.round(between(random, profile.minutes)),
        distanceKm: Number(between(random, profile.km).toFixed(1)),
        fare: Math.round(between(random, profile.fare) / 10) * 10,
      });
    }
  }

  return rides.sort((a, b) => b.startTime - a.startTime);
}
