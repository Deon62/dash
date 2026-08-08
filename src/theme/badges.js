import {
  Bike,
  CalendarCheck,
  CarTaxiFront,
  Coins,
  Crown,
  Globe,
  Moon,
  Mountain,
  Sunrise,
} from "lucide-react-native";

/**
 * Achievement definitions.
 *
 * `progress` is 0–1 toward unlocking and drives the ring on locked medallions;
 * earned badges ignore it. Static for now — wire these to real ride totals when
 * the detection layer lands.
 *
 * `color` is decorative identity, not a data encoding — badges are never
 * compared to each other by hue, and each carries its own glyph and title. The
 * hues come from the validated categorical set so they sit consistently beside
 * the Stats charts. Two hues repeat across the earned/locked split; that is
 * invisible in practice because a locked badge shows its colour only as a thin
 * progress ring, never as a fill.
 */
export const BADGES = [
  {
    id: "early-riser",
    color: "#eb6834",
    Icon: Sunrise,
    title: "Early Riser",
    detail: "10 trips before 7am",
    earned: true,
  },
  {
    id: "lane-splitter",
    color: "#2a78d6",
    Icon: Bike,
    title: "Lane Splitter",
    detail: "25 boda rides",
    earned: true,
  },
  {
    id: "three-wheeler",
    color: "#1baf7a",
    Icon: CarTaxiFront,
    title: "Three Wheeler",
    detail: "15 tuk-tuk rides",
    earned: true,
  },
  {
    id: "regular",
    color: "#4a3aa7",
    Icon: CalendarCheck,
    title: "The Regular",
    detail: "30 day streak",
    earned: true,
  },
  {
    id: "century",
    color: "#2a78d6",
    Icon: Globe,
    title: "Century Club",
    detail: "100 km in a week",
    earned: false,
    progress: 0.72,
  },
  {
    id: "night-owl",
    color: "#4a3aa7",
    Icon: Moon,
    title: "Night Owl",
    detail: "20 trips after 10pm",
    earned: false,
    progress: 0.45,
  },
  {
    id: "fare-hawk",
    color: "#008300",
    Icon: Coins,
    title: "Fare Hawk",
    detail: "Log 50 fares",
    earned: false,
    progress: 0.6,
  },
  {
    id: "long-hauler",
    color: "#e34948",
    Icon: Mountain,
    title: "Long Hauler",
    detail: "A 60 min single leg",
    earned: false,
    progress: 0.3,
  },
  {
    id: "city-royalty",
    color: "#eda100",
    Icon: Crown,
    title: "City Royalty",
    detail: "1,000 km all-time",
    earned: false,
    progress: 0.12,
  },
];
