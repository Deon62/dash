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
 * Every badge starts locked and unearned — users unlock them one at a time.
 * `progress` (0–1) drives the ring on a locked medallion; it is absent until a
 * backend can compute real progress from ride totals.
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
    earned: false,
  },
  {
    id: "lane-splitter",
    color: "#2a78d6",
    Icon: Bike,
    title: "Lane Splitter",
    detail: "25 boda rides",
    earned: false,
  },
  {
    id: "three-wheeler",
    color: "#1baf7a",
    Icon: CarTaxiFront,
    title: "Three Wheeler",
    detail: "15 tuk-tuk rides",
    earned: false,
  },
  {
    id: "regular",
    color: "#4a3aa7",
    Icon: CalendarCheck,
    title: "The Regular",
    detail: "30 day streak",
    earned: false,
  },
  {
    id: "century",
    color: "#2a78d6",
    Icon: Globe,
    title: "Century Club",
    detail: "100 km in a week",
    earned: false,
  },
  {
    id: "night-owl",
    color: "#4a3aa7",
    Icon: Moon,
    title: "Night Owl",
    detail: "20 trips after 10pm",
    earned: false,
  },
  {
    id: "fare-hawk",
    color: "#008300",
    Icon: Coins,
    title: "Fare Hawk",
    detail: "Log 50 fares",
    earned: false,
  },
  {
    id: "long-hauler",
    color: "#e34948",
    Icon: Mountain,
    title: "Long Hauler",
    detail: "A 60 min single leg",
    earned: false,
  },
  {
    id: "city-royalty",
    color: "#eda100",
    Icon: Crown,
    title: "City Royalty",
    detail: "1,000 km all-time",
    earned: false,
  },
];
