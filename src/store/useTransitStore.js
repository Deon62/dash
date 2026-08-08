import { create } from "zustand";

/**
 * Placeholder ride data so every screen has something to render before the
 * motion-detection layer exists. Shape mirrors what the detector will emit.
 */
const MOCK_RECENT_RIDES = [
  {
    id: "r-1",
    vehicleType: "matatu",
    route: "Route 46 · Kawangware → CBD",
    startTime: new Date("2026-08-08T07:12:00"),
    durationMin: 38,
    distanceKm: 9.4,
    fare: 70,
  },
  {
    id: "r-2",
    vehicleType: "boda",
    route: "CBD → Upper Hill",
    startTime: new Date("2026-08-08T08:05:00"),
    durationMin: 11,
    distanceKm: 3.1,
    fare: 150,
  },
  {
    id: "r-3",
    vehicleType: "tuktuk",
    route: "Upper Hill → Kilimani",
    startTime: new Date("2026-08-07T18:40:00"),
    durationMin: 16,
    distanceKm: 4.2,
    fare: 200,
  },
  {
    id: "r-4",
    vehicleType: "matatu",
    route: "Route 111 · Ngong → CBD",
    startTime: new Date("2026-08-07T06:55:00"),
    durationMin: 44,
    distanceKm: 12.8,
    fare: 100,
  },
  {
    id: "r-5",
    vehicleType: "other",
    route: "Rideshare · Westlands → Home",
    startTime: new Date("2026-08-06T21:15:00"),
    durationMin: 27,
    distanceKm: 8.0,
    fare: 620,
  },
];

const EMPTY_TRIP = {
  vehicleType: null,
  startTime: null,
  isDetecting: false,
};

export const useTransitStore = create((set, get) => ({
  /** The person the header avatar and Wrapped card belong to. */
  profile: {
    name: "Daniel Ochieng",
    initials: "DO",
    homeCity: "Nairobi",
    memberSince: "2025",
  },

  /** `{ vehicleType, startTime, isDetecting }` — null vehicleType means idle. */
  activeTrip: EMPTY_TRIP,

  recentRides: MOCK_RECENT_RIDES,

  /** Flip the sensor listener on/off without committing to a vehicle yet. */
  toggleDetection: () =>
    set((state) => ({
      activeTrip: {
        ...state.activeTrip,
        isDetecting: !state.activeTrip.isDetecting,
      },
    })),

  /** Detector (or the user) settled on a mode — start the clock. */
  startTrip: (vehicleType) =>
    set({
      activeTrip: {
        vehicleType,
        startTime: new Date(),
        isDetecting: true,
      },
    }),

  /** Close the active trip and push it onto the recents list. */
  endTrip: () => {
    const { activeTrip, recentRides } = get();
    if (!activeTrip.vehicleType || !activeTrip.startTime) {
      set({ activeTrip: EMPTY_TRIP });
      return;
    }

    const durationMin = Math.max(
      1,
      Math.round((Date.now() - activeTrip.startTime.getTime()) / 60000)
    );

    const ride = {
      id: `r-${Date.now()}`,
      vehicleType: activeTrip.vehicleType,
      route: "Unnamed trip",
      startTime: activeTrip.startTime,
      durationMin,
      distanceKm: 0,
      fare: 0,
    };

    set({ activeTrip: EMPTY_TRIP, recentRides: [ride, ...recentRides] });
  },

  addRide: (ride) =>
    set((state) => ({ recentRides: [ride, ...state.recentRides] })),

  resetTrip: () => set({ activeTrip: EMPTY_TRIP }),
}));
