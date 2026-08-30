import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { setPendingReferralCode, tidyCode } from "@/lib/referrals";
import { useStudyStore } from "@/store/useStudyStore";

/**
 * A friend's link: `als://refer/K7M2QX`, or `com.ardena.als://refer/K7M2QX`.
 *
 * Not a screen. An incoming link is a navigation whether or not anything
 * wanted one, so this route exists to catch the code, put it where sign-in
 * will find it, and get out of the way in the same frame.
 *
 * `/refer/` rather than `/join/` because `app/join.jsx` is already the Friends
 * group-code screen, and two different codes arriving at one route is a bug
 * waiting for the day somebody pastes the wrong one.
 *
 * Where it sends them afterwards is the interesting part. A signed-out student
 * goes to the sign-in screen with the code already held — attribution is
 * written when the account is *created*, so it has to be waiting before they
 * sign in. Someone already signed in is sent to their own referral screen
 * instead: their account exists, the code will be ignored by the server, and
 * dropping them on a sign-in page they do not need would read as being logged
 * out. The route guard would bounce them anyway.
 */
export default function ReferLanding() {
  const router = useRouter();
  const { code } = useLocalSearchParams();

  const hydrated = useStudyStore((state) => state.hydrated);
  const isAuthenticated = useStudyStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Waiting on hydration: until the stored session has been read back, an
    // account that exists looks signed out, and the redirect below would be
    // decided on a state that is about to change.
    if (!hydrated) return;

    const tidy = tidyCode(code);

    // Held whether or not it is any good. The server ignores an unknown code
    // and creates the account normally, and nothing on the device is allowed
    // to have an opinion about which codes are real.
    setPendingReferralCode(tidy);

    router.replace(isAuthenticated ? "/referrals" : "/login");
  }, [hydrated, isAuthenticated, code, router]);

  // Deliberately blank. Anything drawn here is a flash of a screen nobody
  // asked to see, on the way to one they did.
  return <View className="flex-1 bg-canvas" />;
}
