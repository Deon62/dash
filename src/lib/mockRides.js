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

// Weighted to a plausible Nairobi commute: matatus dominate, bicycles are rare.
const MODE_WEIGHTS = [
  { key: "matatu", weight: 0.34 },
  { key: "motorbike", weight: 0.19 },
  { key: "nganya", weight: 0.12 },
  { key: "bus", weight: 0.1 },
  { key: "tuktuk", weight: 0.08 },
  { key: "taxi", weight: 0.07 },
  { key: "train", weight: 0.05 },
  { key: "bicycle", weight: 0.03 },
  { key: "other", weight: 0.02 },
];

const PROFILES = {
  matatu: { minutes: [26, 55], km: [7, 15], fare: [50, 120] },
  bus: { minutes: [30, 65], km: [9, 20], fare: [60, 140] },
  nganya: { minutes: [24, 50], km: [7, 14], fare: [70, 150] },
  train: { minutes: [35, 60], km: [12, 24], fare: [100, 180] },
  taxi: { minutes: [18, 45], km: [6, 18], fare: [400, 900] },
  tuktuk: { minutes: [10, 22], km: [3, 6], fare: [150, 260] },
  motorbike: { minutes: [7, 18], km: [2, 5], fare: [100, 220] },
  bicycle: { minutes: [12, 30], km: [3, 8], fare: [0, 0] },
  other: { minutes: [15, 40], km: [4, 12], fare: [80, 400] },
};

const ROUTES = {
  matatu: [
    "Route 46 · Kawangware → CBD",
    "Route 111 · Ngong → CBD",
    "Route 58 · Buruburu → CBD",
    "Route 33 · Embakasi → CBD",
    "Route 24 · South B → CBD",
  ],
  bus: ["Citi Hoppa · Rongai → CBD", "Super Metro · Thika Rd → CBD"],
  nganya: ["Route 45 · Kayole → CBD", "Route 17B · Kangemi → CBD"],
  train: ["Commuter rail · Syokimau → CBD", "Commuter rail · Ruiru → CBD"],
  taxi: ["Rideshare · Westlands → Home", "Rideshare · Airport → CBD"],
  tuktuk: ["Upper Hill → Kilimani", "Kilimani → Yaya", "Adams Arcade → Home"],
  motorbike: [
    "CBD → Upper Hill",
    "CBD → Ngara",
    "Home → Junction Mall",
    "Westlands → Parklands",
  ],
  bicycle: ["Home → Karura", "Kilimani → CBD"],
  other: ["Walked · CBD → Station", "Lift · Westlands → Home"],
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
