import { Bike, Bus, CarTaxiFront, TrainFront } from "lucide-react-native";

/**
 * Single source of truth for the four transit modes.
 *
 * The UI is monochrome — mode identity is carried by the icon and label. `color`
 * is the categorical chart slot and is used *only* by chart marks, never by
 * icons or text. Slots are assigned per mode and fixed: colour follows the
 * entity, so filtering or reordering never repaints a mode.
 *
 * Palette validated on a #FFFFFF surface (worst adjacent CVD ΔE 9.1, normal
 * vision 22.9). Aqua and yellow fall under 3:1 against white, so every chart
 * using them must carry visible labels — the breakdown list does that.
 */
export const TRANSIT_MODES = {
  matatu: { key: "matatu", label: "Matatu", Icon: Bus, color: "#2a78d6" },
  boda: { key: "boda", label: "Boda Boda", Icon: Bike, color: "#eb6834" },
  tuktuk: { key: "tuktuk", label: "Tuk-Tuk", Icon: CarTaxiFront, color: "#1baf7a" },
  other: { key: "other", label: "Other", Icon: TrainFront, color: "#eda100" },
};

export const MODE_KEYS = Object.keys(TRANSIT_MODES);

/** Never returns undefined — unknown / unlabelled rides fall back to `other`. */
export function getMode(key) {
  return TRANSIT_MODES[key] ?? TRANSIT_MODES.other;
}
