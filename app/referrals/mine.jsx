import { Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";

import EmptyArt from "../../assets/offline.svg";
import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import { useReferral } from "@/lib/referrals";

/**
 * What this student's code has actually done.
 *
 * Counts, not people. The API names nobody and no route is coming: a screen
 * listing which friends did and did not subscribe is a screen that makes
 * students chase their friends, and this one exists to answer "has anything
 * landed yet" without doing that.
 *
 * `joined` is shown beside `paid` rather than on its own. Five signed up and
 * two subscribed is honest and worth knowing; five signed up, alone, next to
 * nothing earned reads as the app owing somebody something.
 */

/** One number, and what it counts. */
function Figure({ label, value, hint, last = false }) {
  return (
    <View
      className={`flex-row items-start justify-between py-4 ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      <View className="flex-1 pr-4">
        <Text className="font-jk text-ink text-[14px]">{label}</Text>
        {hint ? (
          <Text className="font-jk text-muted text-[12px] leading-[17px] mt-0.5">
            {hint}
          </Text>
        ) : null}
      </View>

      <Text className="font-jk-semi text-ink text-[17px]">{value}</Text>
    </View>
  );
}

export default function MyReferralsScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const { joined, paid, daysEarned, daysBanked, bankedPendingSubscription } =
    useReferral();

  const nothing = joined === 0 && paid === 0 && daysBanked === 0;

  // The drawing is 583×383. Sized against the shorter dimension so it stays
  // whole on a small handset, the same way the offline screen does it.
  const artWidth = Math.min(width * 0.58, height * 0.3 * 1.52, 280);

  return (
    <Screen bare name="referrals-mine">
      <ScreenHeader title="My referrals" />

      {nothing ? (
        /* No numbers above an empty page. A column of zeroes is a scoreboard
           nobody is winning, and it is the first thing a student sees on the
           day they have done nothing wrong. */
        <View className="items-center px-4 py-6">
          <EmptyArt width={artWidth} height={artWidth / 1.52} />

          <Text className="font-jk-semi text-ink text-[16px] text-center mt-7">
            Nothing yet
          </Text>
          <Text className="font-jk text-muted text-[13px] leading-[19px] text-center mt-2">
            Send your code to someone in your class. When they pay for a plan,
            what you have earned appears here.
          </Text>

          <View className="mt-7">
            <Button
              label="Get your code"
              variant="soft"
              onPress={() => router.back()}
            />
          </View>
        </View>
      ) : (
        <>
          <View>
            <Figure
              label="Friends who subscribed"
              hint={
                joined > paid
                  ? `${joined} signed up with your code`
                  : "The ones who earned you days"
              }
              value={paid}
            />
            <Figure
              label="Days earned"
              hint="Already added to your plan"
              value={daysEarned}
            />
            <Figure
              label="Days banked"
              hint={
                bankedPendingSubscription
                  ? "Waiting on your own first payment"
                  : "Credited to your plan shortly"
              }
              value={daysBanked}
              last
            />
          </View>

          {/* The banked days are the whole argument for this button, which is
              why it appears here and only when there are some. */}
          {bankedPendingSubscription && daysBanked > 0 ? (
            <Button label="See plans" onPress={() => router.push("/billing")} />
          ) : null}

          <Text className="font-jk text-muted text-[11.5px] leading-[17px]">
            Days are held for a week before they are credited, so a friend's
            payment takes a few days to show up here. They extend the plan you
            hold rather than sitting in a balance.
          </Text>
        </>
      )}
    </Screen>
  );
}
