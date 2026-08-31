import * as WebBrowser from "expo-web-browser";

import { impact } from "@/lib/haptics";

/**
 * The published policies, and the one way to open them.
 *
 * Here rather than beside the screens that link to them, because more than one
 * does: the sign-in page has to show both before anybody agrees to anything,
 * and the in-app privacy summary points at the full text underneath it. Two
 * copies of the same URL in two files is how one of them ends up pointing at a
 * page that moved.
 */
export const TERMS_URL = "https://als.ardena.co.ke/terms";
export const PRIVACY_URL = "https://als.ardena.co.ke/privacy";

/**
 * Opens in the in-app browser, which keeps whatever is behind it alive.
 *
 * Nothing is awaited and the rejection is swallowed for a reason: these are
 * links on screens in the middle of doing something — signing in, reading a
 * settings page — and a browser that will not open must not be able to throw
 * its way into either.
 */
export function openLegal(url) {
  impact("light");
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
