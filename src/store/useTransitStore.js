import { create } from "zustand";

import { DEFAULT_PERIOD } from "@/theme/periods";
import { generateRides } from "@/lib/mockRides";

const EMPTY_TRIP = {
  vehicleType: null,
  startTime: null,
  isDetecting: false,
};

export const useTransitStore = create((set, get) => ({
  /** The person the header avatar and Wrapped card belong to. */
  profile: {
    name: "Daniel Ochieng",
    email: "daniel@transit.app",
    initials: "DO",
    /** Local file URI from the picker; null falls back to the initials. */
    avatarUri: null,
    homeCity: "Nairobi",
    memberSince: "2025",
    streakDays: 12,
  },

  setAvatar: (avatarUri) =>
    set((state) => ({ profile: { ...state.profile, avatarUri } })),

  /** Merge a partial profile — used by the account editor. */
  updateProfile: (patch) =>
    set((state) => {
      const profile = { ...state.profile, ...patch };
      // Keep the fallback initials in step with the name.
      if (patch.name) {
        profile.initials =
          patch.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("") || profile.initials;
      }
      return { profile };
    }),

  /**
   * Session flag only. There is no auth backend — the sign-in screens set this
   * so navigation behaves, and nothing here validates a credential.
   */
  isAuthenticated: true,
  signIn: (email) =>
    set((state) => ({
      isAuthenticated: true,
      profile: { ...state.profile, email: email || state.profile.email },
    })),

  /** `{ vehicleType, startTime, isDetecting }` — null vehicleType means idle. */
  activeTrip: EMPTY_TRIP,

  recentRides: generateRides(),

  /** Reporting window for the Stats page — a key from `theme/periods`. */
  statsPeriod: DEFAULT_PERIOD,
  setStatsPeriod: (statsPeriod) => set({ statsPeriod }),

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

  /**
   * Placeholder sign-out: clears session state only. There is no auth layer
   * yet, so this does not revoke a token or navigate anywhere — wire it up
   * when accounts land.
   */
  logout: () =>
    set({ activeTrip: EMPTY_TRIP, recentRides: [], isAuthenticated: false }),
}));
