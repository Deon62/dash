import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import Button from "@/components/Button";
import { shareMessage, useReferral } from "@/lib/referrals";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

/**
 * How referrals work, and the code itself.
 *
 * Everything about the programme lives here rather than being spread across a
 * card on the profile screen as well: two surfaces saying the same thing is
 * two places for the copy to go stale, and the profile page is a list of
 * destinations, not a place to sell something.
 *
 * The one thing every line has to be truthful about: nothing is earned until
 * the friend who used the code pays.
 *
 * There is no list of who joined. The API has counts and not people, on
 * purpose — a screen naming which friends did and did not subscribe is a
 * screen that makes students chase them.
 */

/**
 * What a referrer gets. Not in the payload — `friend_days` is the only reward
 * the server sends — so it is written here and has to be changed here if the
 * programme changes. The friend's week always comes from the server.
 */
const REFERRER_DAYS = 14;
const REFERRER_DAYS_SEASON = 30;

/** One rule, as a line: what it is worth, then who gets it and when. */
function Rule({ days, title, detail, last = false }) {
  return (
    <View
      className={`flex-row py-3.5 ${last ? "" : "border-b border-hairline"}`}
    >
      {/* The number leads. It is the whole argument, and a sentence that has
          to be read to the end before it says "+14 days" is a sentence that
          gets skipped. */}
      <Text className="font-jk-semi text-ink text-[15px] w-[74px]">
        +{days} days
      </Text>

      <View className="flex-1 pl-2">
        <Text className="font-jk-med text-ink text-[13.5px]">{title}</Text>
        <Text className="font-jk text-muted text-[12.5px] leading-[18px] mt-0.5">
          {detail}
        </Text>
      </View>
    </View>
  );
}

export default function ReferralsScreen() {
  const router = useRouter();
  const referral = useReferral();
  const { code, friendDays } = referral;

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    impact("light");
    await Clipboard.setStringAsync(code);
    setCopied(true);
    notify("success");
    // Reverts on its own — a "Copied" that never leaves stops meaning anything
    // by the second tap.
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!code) return;
    impact("medium");
    await Share.share({ message: shareMessage(referral) });
  };

  return (
    <Screen bare name="referrals">
      {/* A word, not a glyph. There is no icon that means "what my code has
          earned", and a guessable one beside the back arrow would be a second
          mystery button on a screen whose whole job is to explain something.

          It wears the back arrow's grey disc, stretched into a pill: the two
          controls sit on the same line, and one of them floating as bare blue
          text made the row look unfinished. Every top-of-screen control in the
          app is a glyph on `surface`, and this is the same affordance with a
          word in it. */}
      <ScreenHeader
        title="Invite a friend"
        right={
          <Pressable
            onPress={() => {
              impact("light");
              router.push("/referrals/mine");
            }}
            accessibilityRole="link"
            accessibilityLabel="My referrals"
            hitSlop={8}
            style={{
              height: 40,
              borderRadius: 20,
              paddingHorizontal: 16,
              backgroundColor: COLORS.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
            className="active:opacity-60"
          >
            <Text className="font-jk-med text-ink text-[13px]">
              My referrals
            </Text>
          </Pressable>
        }
      />

      {/* The rules in a card of their own. They are the offer — the one part
          of this page a student is deciding on — and an edge around them says
          that before a word is read, the way the plan cards do. */}
      <View
        style={{
          // A little air under the heading. With the description gone the card
          // sat straight against the title, and the page read as two blocks
          // shoved together rather than a heading and what it introduces.
          marginTop: 6,
          borderColor: COLORS.line,
          borderWidth: 1,
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 6,
        }}
      >
        <Rule
          days={friendDays}
          title="Your friend"
          detail="On whatever plan they buy, at their first purchase. Once, ever."
        />
        <Rule
          days={REFERRER_DAYS}
          title="You, on a paid plan"
          detail={`Added to the plan you hold. ${REFERRER_DAYS_SEASON} days if they buy a Season.`}
        />
        <Rule
          days={REFERRER_DAYS}
          title="You, on Free"
          detail="Banked, not lost. The days start the day you subscribe."
          last
        />
      </View>

      {/* The code is the one thing on this page anybody comes back for, so it
          is centred and given room rather than set as another left-aligned
          row. Letter-spaced, because it gets read aloud across a lecture hall
          and typed off a screenshot. No glyph beside it: the line underneath
          already says what tapping does, and saying it twice in two alphabets
          is not clearer. */}
      <View className="items-center py-2">
        <Pressable
          onPress={copy}
          disabled={!code}
          accessibilityRole="button"
          accessibilityLabel={code ? `Copy referral code ${code}` : "No code yet"}
          hitSlop={12}
          className={code ? "active:opacity-60" : ""}
        >
          <Text
            style={{ color: code ? COLORS.ink : COLORS.faint }}
            className="font-jk-bold text-[26px] tracking-[5px]"
          >
            {code ?? "— — — —"}
          </Text>
        </Pressable>

        <Text className="font-jk text-muted text-[12px] text-center mt-2.5">
          {!code ? "Fetching your code…" : copied ? "Code copied" : "Tap to copy"}
        </Text>
      </View>

      <Button label="Share your code" disabled={!code} onPress={share} />

      <Text className="font-jk text-muted text-[11.5px] leading-[17px] text-center">
        Nothing is earned until a friend who used your code pays. Days are added
        to the plan in force, so they show up as a later renewal date.
      </Text>
    </Screen>
  );
}
