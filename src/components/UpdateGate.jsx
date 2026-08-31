import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDownToLine } from "lucide-react-native";

import Button from "@/components/Button";
import Disc from "@/components/Disc";
import { COLORS } from "@/theme/colors";
import { openStore, useStoreUpdateCheck, useUpdatePrompt } from "@/lib/appUpdate";

/**
 * The build in hand is too old to keep running.
 *
 * A cover rather than a `Modal`, and mounted beside `AppLock` for the same
 * reason: unmounting the routes to show this would throw away every screen's
 * state, and a `Modal` can be dismissed by the Android back button, which is
 * precisely what must not happen here.
 *
 * There is no way out on purpose, and that is why the flag behind it is never
 * inferred from being merely behind. This appears only when an administrator
 * has raised the floor past this build — one person deciding that a build is
 * doing damage on the network, having first looked at how many students it
 * locks out. Everything short of that is the card below, which dismisses.
 *
 * It says *what* stopped working rather than "please update". A student in the
 * middle of revision is owed the reason they are being interrupted.
 *
 * The check that feeds it is mounted here too, so the one thing that has to
 * work for somebody who cannot sign in does not depend on anything that needs a
 * session.
 */
export default function UpdateGate() {
  useStoreUpdateCheck();

  const update = useUpdatePrompt();
  const insets = useSafeAreaInsets();

  if (!update.required) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.canvas,
        paddingTop: insets.top + 24,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
        paddingHorizontal: 24,
        justifyContent: "center",
      }}
      accessibilityViewIsModal
    >
      <Disc size={52}>
        <ArrowDownToLine size={24} color={COLORS.ink} strokeWidth={1.8} />
      </Disc>

      <Text className="font-jk-bold text-ink text-[26px] leading-[32px] mt-6">
        Time to update
      </Text>

      <Text className="font-jk text-muted text-[14.5px] leading-[21px] mt-3">
        {/* The floor, named. "Builds before 1.4.0 can no longer sync" is a
            sentence a student can act on and check; "please update" is not.
            The fallback covers a release row with no minimum recorded, which
            should not reach here but must still read as a sentence. */}
        {update.minimum
          ? `Versions before ${update.minimum} can no longer reach your account. ` +
            "Your coursework is safe — it is on the account, waiting for the new build."
          : "This version can no longer reach your account. Your coursework is safe on the account, waiting for the new build."}
      </Text>

      {update.notes ? (
        <View className="rounded-2xl bg-surface px-4 py-3.5 mt-5">
          <Text className="font-jk text-ink text-[13.5px] leading-[19px]">
            {update.notes}
          </Text>
        </View>
      ) : null}

      <View className="mt-8">
        {/* One control, and no "not now" beside it. A dismiss on a forced
            update is not a kindness — it is a second screen that has to explain
            itself, on a build that has already stopped working. */}
        <Button
          label={update.version ? `Update to ${update.version}` : "Open the store"}
          Icon={ArrowDownToLine}
          onPress={() => openStore(update.storeUrl)}
        />
      </View>
    </View>
  );
}
