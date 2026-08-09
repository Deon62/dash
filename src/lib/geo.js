import { COUNTRIES, DEFAULT_COUNTRY } from "@/theme/countries";

/**
 * Best-effort country guess from the caller's IP, used only to preselect the
 * dialling code — the user can always change it, so a wrong guess costs a tap.
 *
 * Two providers because both are free and unauthenticated, and free tiers rate
 * limit; whichever answers first wins. Everything is wrapped so a failure or a
 * slow network can never block the sign-in screen.
 */
const PROVIDERS = [
  { url: "https://ipwho.is/", read: (json) => json?.country_code },
  { url: "https://ipinfo.io/json", read: (json) => json?.country },
];

const TIMEOUT_MS = 4000;

async function ask({ url, read }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const iso = read(await response.json());
    // Ignore anything not in the dialling list — an unknown code would show a
    // blank flag and no dial prefix.
    return COUNTRIES.some((c) => c.iso === iso) ? iso : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves to an ISO code that is always present in COUNTRIES. */
export async function detectCountry() {
  for (const provider of PROVIDERS) {
    const iso = await ask(provider);
    if (iso) return iso;
  }
  return DEFAULT_COUNTRY;
}
