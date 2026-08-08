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
 */
export const BADGES = [
  {
    id: "early-riser",
    Icon: Sunrise,
    title: "Early Riser",
    detail: "10 trips before 7am",
    earned: true,
  },
  {
    id: "lane-splitter",
    Icon: Bike,
    title: "Lane Splitter",
    detail: "25 boda rides",
    earned: true,
  },
  {
    id: "three-wheeler",
    Icon: CarTaxiFront,
    title: "Three Wheeler",
    detail: "15 tuk-tuk rides",
    earned: true,
  },
  {
    id: "regular",
    Icon: CalendarCheck,
    title: "The Regular",
    detail: "30 day streak",
    earned: true,
  },
  {
    id: "century",
    Icon: Globe,
    title: "Century Club",
    detail: "100 km in a week",
    earned: false,
    progress: 0.72,
  },
  {
    id: "night-owl",
    Icon: Moon,
    title: "Night Owl",
    detail: "20 trips after 10pm",
    earned: false,
    progress: 0.45,
  },
  {
    id: "fare-hawk",
    Icon: Coins,
    title: "Fare Hawk",
    detail: "Log 50 fares",
    earned: false,
    progress: 0.6,
  },
  {
    id: "long-hauler",
    Icon: Mountain,
    title: "Long Hauler",
    detail: "A 60 min single leg",
    earned: false,
    progress: 0.3,
  },
  {
    id: "city-royalty",
    Icon: Crown,
    title: "City Royalty",
    detail: "1,000 km all-time",
    earned: false,
    progress: 0.12,
  },
];
