import { Bike, Bus, CarTaxiFront, TrainFront } from "lucide-react-native";

/**
 * Single source of truth for the four transit modes.
 *
 * Deliberately monochrome — mode identity is carried by the icon and label, not
 * by colour. The `transit-*` accent tokens still exist in `tailwind.config.js`
 * if a future surface (a chart, a highlight) needs to reintroduce colour.
 */
export const TRANSIT_MODES = {
  matatu: { key: "matatu", label: "Matatu", Icon: Bus },
  boda: { key: "boda", label: "Boda Boda", Icon: Bike },
  tuktuk: { key: "tuktuk", label: "Tuk-Tuk", Icon: CarTaxiFront },
  other: { key: "other", label: "Other", Icon: TrainFront },
};

export const MODE_KEYS = Object.keys(TRANSIT_MODES);

/** Never returns undefined — unknown / unlabelled rides fall back to `other`. */
export function getMode(key) {
  return TRANSIT_MODES[key] ?? TRANSIT_MODES.other;
}
