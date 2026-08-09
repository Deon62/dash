import {
  Bike,
  Bus,
  BusFront,
  Car,
  CarTaxiFront,
  Caravan,
  Ellipsis,
  Music4,
  TrainFront,
  Zap,
} from "lucide-react-native";

/**
 * Single source of truth for the transit modes.
 *
 * The UI is monochrome — mode identity is carried by the icon and label. `color`
 * is the categorical chart slot and is used *only* by chart marks, never by
 * icons or text. Slots are assigned per mode and fixed: colour follows the
 * entity, so filtering or reordering never repaints a mode.
 *
 * There are more modes than the categorical palette has slots. That is fine
 * here: nothing compares modes by hue alone — every picker tile and every chart
 * bar carries its own label.
 */
export const TRANSIT_MODES = {
  matatu: { key: "matatu", label: "Matatu", Icon: Bus, color: "#2a78d6" },
  bus: { key: "bus", label: "Bus", Icon: BusFront, color: "#eb6834" },
  // Nganya: the loud, painted, sound-system matatu — hence the glyph.
  nganya: { key: "nganya", label: "Nganya", Icon: Music4, color: "#1baf7a" },
  train: { key: "train", label: "Train", Icon: TrainFront, color: "#eda100" },
  taxi: { key: "taxi", label: "Taxi", Icon: CarTaxiFront, color: "#e87ba4" },
  tuktuk: { key: "tuktuk", label: "Tuk-Tuk", Icon: Caravan, color: "#008300" },
  motorbike: { key: "motorbike", label: "Boda Boda", Icon: Zap, color: "#4a3aa7" },
  bicycle: { key: "bicycle", label: "Bicycle", Icon: Bike, color: "#e34948" },
  other: { key: "other", label: "Other", Icon: Ellipsis, color: "#52525B" },
};

export const MODE_KEYS = Object.keys(TRANSIT_MODES);

/** Never returns undefined — unknown / unlabelled rides fall back to `other`. */
export function getMode(key) {
  return TRANSIT_MODES[key] ?? TRANSIT_MODES.other;
}
