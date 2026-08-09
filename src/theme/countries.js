/**
 * Dialling codes for the phone sign-in.
 *
 * Not exhaustive — East Africa first, then the markets most likely to come up.
 * The flag is derived from the ISO code rather than shipped as an image: two
 * regional-indicator codepoints render as a flag on both platforms, so there is
 * nothing to download and it works offline.
 */
/**
 * `nsn` is the national significant number length — the digits after the
 * dialling code, with the trunk `0` removed. A Kenyan mobile is 0712 345 678
 * locally but +254 712 345 678 internationally, so `nsn` is 9 and the leading
 * zero is stripped as the user types.
 *
 * It is only set where the length is genuinely fixed. Countries with variable
 * mobile lengths are deliberately left without one and fall back to a generic
 * range rather than rejecting valid numbers.
 */
export const COUNTRIES = [
  { iso: "KE", name: "Kenya", dial: "+254", nsn: 9 },
  { iso: "UG", name: "Uganda", dial: "+256", nsn: 9 },
  { iso: "TZ", name: "Tanzania", dial: "+255", nsn: 9 },
  { iso: "RW", name: "Rwanda", dial: "+250", nsn: 9 },
  { iso: "BI", name: "Burundi", dial: "+257", nsn: 8 },
  { iso: "SS", name: "South Sudan", dial: "+211", nsn: 9 },
  { iso: "ET", name: "Ethiopia", dial: "+251", nsn: 9 },
  { iso: "SO", name: "Somalia", dial: "+252" },
  { iso: "NG", name: "Nigeria", dial: "+234", nsn: 10 },
  { iso: "GH", name: "Ghana", dial: "+233", nsn: 9 },
  { iso: "ZA", name: "South Africa", dial: "+27", nsn: 9 },
  { iso: "ZM", name: "Zambia", dial: "+260", nsn: 9 },
  { iso: "ZW", name: "Zimbabwe", dial: "+263", nsn: 9 },
  { iso: "MW", name: "Malawi", dial: "+265", nsn: 9 },
  { iso: "MZ", name: "Mozambique", dial: "+258" },
  { iso: "BW", name: "Botswana", dial: "+267", nsn: 8 },
  { iso: "NA", name: "Namibia", dial: "+264", nsn: 9 },
  { iso: "EG", name: "Egypt", dial: "+20", nsn: 10 },
  { iso: "MA", name: "Morocco", dial: "+212", nsn: 9 },
  { iso: "SN", name: "Senegal", dial: "+221", nsn: 9 },
  { iso: "CI", name: "Côte d'Ivoire", dial: "+225", nsn: 10 },
  { iso: "CM", name: "Cameroon", dial: "+237", nsn: 9 },
  { iso: "CD", name: "DR Congo", dial: "+243" },
  { iso: "GB", name: "United Kingdom", dial: "+44", nsn: 10 },
  { iso: "US", name: "United States", dial: "+1", nsn: 10 },
  { iso: "CA", name: "Canada", dial: "+1", nsn: 10 },
  { iso: "IE", name: "Ireland", dial: "+353", nsn: 9 },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33", nsn: 9 },
  { iso: "NL", name: "Netherlands", dial: "+31", nsn: 9 },
  { iso: "ES", name: "Spain", dial: "+34", nsn: 9 },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "PT", name: "Portugal", dial: "+351" },
  { iso: "SE", name: "Sweden", dial: "+46", nsn: 9 },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", nsn: 9 },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", nsn: 9 },
  { iso: "QA", name: "Qatar", dial: "+974", nsn: 8 },
  { iso: "TR", name: "Türkiye", dial: "+90", nsn: 10 },
  { iso: "IN", name: "India", dial: "+91", nsn: 10 },
  { iso: "PK", name: "Pakistan", dial: "+92", nsn: 10 },
  { iso: "CN", name: "China", dial: "+86", nsn: 11 },
  { iso: "JP", name: "Japan", dial: "+81", nsn: 10 },
  { iso: "AU", name: "Australia", dial: "+61", nsn: 9 },
  { iso: "BR", name: "Brazil", dial: "+55", nsn: 11 },
];

export const DEFAULT_COUNTRY = "KE";

/** ISO 3166-1 alpha-2 → regional indicator pair. */
export function flagEmoji(iso) {
  if (!iso || iso.length !== 2) return "";
  return iso
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

export function getCountry(iso) {
  return (
    COUNTRIES.find((c) => c.iso === iso) ??
    COUNTRIES.find((c) => c.iso === DEFAULT_COUNTRY)
  );
}

/** Fallback bounds for countries whose mobile length isn't fixed. */
const GENERIC_MIN = 7;
const GENERIC_MAX = 12;

/**
 * Reduce whatever the user typed to a national significant number.
 *
 * Handles the three things people actually do: typing the local form with a
 * trunk zero (0712…), pasting the full international form (+254712… or
 * 254712…), and typing spaces or dashes. The result is always the digits that
 * belong after the dialling code, clamped so it can't exceed a valid length.
 */
export function normalisePhone(raw, country) {
  let digits = String(raw ?? "").replace(/\D/g, "");

  // Pasted international form — drop the country code before anything else.
  const dial = country.dial.replace("+", "");
  if (dial !== "1" && digits.startsWith(dial) && digits.length > dial.length) {
    digits = digits.slice(dial.length);
  }

  // Trunk prefix. No national number in this list legitimately starts with 0.
  digits = digits.replace(/^0+/, "");

  return digits.slice(0, country.nsn ?? GENERIC_MAX);
}

/** True when the number is a plausible length for the selected country. */
export function isPhoneComplete(digits, country) {
  if (country.nsn) return digits.length === country.nsn;
  return digits.length >= GENERIC_MIN && digits.length <= GENERIC_MAX;
}

/** Short hint shown under the field, e.g. "9 digits after +254". */
export function phoneHint(country) {
  return country.nsn
    ? `${country.nsn} digits after ${country.dial}`
    : `Number without the leading 0`;
}
