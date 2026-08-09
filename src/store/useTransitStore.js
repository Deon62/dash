import { create } from "zustand";

import { DEFAULT_PERIOD } from "@/theme/periods";

const EMPTY_TRIP = {
  vehicleType: null,
  startTime: null,
  isDetecting: false,
};

/**
 * A brand-new account. Nothing is seeded — every screen renders its empty
 * state until the user logs a trip or a backend supplies real history.
 */
const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: null,
  initials: "",
  /** Local file URI from the picker; empty falls back to a placeholder glyph. */
  avatarUri: null,
  homeCity: "",
  memberSince: String(new Date().getFullYear()),
  streakDays: 0,
};

export const useTransitStore = create((set, get) => ({
  profile: { ...EMPTY_PROFILE },

  /** Everything reachable from the profile settings list. */
  settings: {
    motionDetection: true,
    /** ISO currency code — seeded from the detected country at sign-in. */
    currency: "KES",
  },

  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),

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
   *
   * Takes whichever identity the chosen method produced: `{ phone }` from the
   * SMS flow, `{ email, name }` from an OAuth provider once one is wired.
   */
  isAuthenticated: true,
  signIn: (identity = {}) =>
    set((state) => ({
      isAuthenticated: true,
      // Ride history will come from the backend on sign-in. Until then a new
      // session simply starts empty.
      profile: {
        ...state.profile,
        ...(identity.email ? { email: identity.email } : {}),
        ...(identity.phone ? { phone: identity.phone } : {}),
        ...(identity.name ? { name: identity.name } : {}),
      },
    })),

  /** `{ vehicleType, startTime, isDetecting }` — null vehicleType means idle. */
  activeTrip: EMPTY_TRIP,

  recentRides: [],

  /** Reporting window for the Stats page — a key from `theme/periods`. */
  statsPeriod: DEFAULT_PERIOD,
  setStatsPeriod: (statsPeriod) => set({ statsPeriod }),

  /**
   * Set when the (simulated) detector believes a trip has started but the mode
   * is still unknown. The Trips screen turns this into a prompt.
   */
  pendingDetection: false,
  flagDetection: () => set({ pendingDetection: true }),
  dismissDetection: () => set({ pendingDetection: false }),

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
      pendingDetection: false,
      activeTrip: {
        vehicleType,
        startTime: new Date(),
        isDetecting: true,
      },
    }),

  /** Close the active trip and push it onto the recents list. */
  endTrip: (fare = 0) => {
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
      // Distance needs real GPS tracking; the fare is whatever the rider paid.
      distanceKm: 0,
      fare: Number(fare) || 0,
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

  /**
   * Placeholder account deletion: wipes local state only. There is no backend,
   * so nothing is deleted server-side — wire this to a real endpoint before it
   * can be trusted to actually remove anything.
   */
  deleteAccount: () =>
    set({
      activeTrip: EMPTY_TRIP,
      recentRides: [],
      isAuthenticated: false,
      profile: { ...EMPTY_PROFILE },
    }),
}));
