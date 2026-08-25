import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  BellRing,
  FingerprintPattern,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import LinkRow from "@/components/LinkRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useStudyStore } from "@/store/useStudyStore";
import { authenticate, describe, isAvailable } from "@/lib/biometrics";

export default function SettingsScreen() {
  const router = useRouter();

  const settings = useStudyStore((state) => state.settings);
  const updateSettings = useStudyStore((state) => state.updateSettings);
  const resetEverything = useStudyStore((state) => state.resetEverything);

  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);
  const [biometry, setBiometry] = useState({ available: false, name: "Biometrics" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([isAvailable(), describe()]).then(([available, name]) => {
      if (!cancelled) setBiometry({ available, name });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Turning the lock on has to prove it works first. A switch that flips
   * without a prompt can leave someone locked out by a sensor that was never
   * going to read, on the one screen where that is unrecoverable.
   */
  const setLock = async (next) => {
    if (!next) {
      updateSettings({ biometricLock: false });
      return;
    }

    if (!biometry.available) {
      setNotice("This device has no fingerprint or face unlock set up yet. Add one in your phone's settings first.");
      return;
    }

    const result = await authenticate("Turn on the lock for ALS");
    if (result.ok) updateSettings({ biometricLock: true });
  };

  return (
    <Screen bare>
      <ScreenHeader title="Settings" />

      <View>
        <LinkRow
          Icon={BellRing}
          label="Notification preferences"
          hint="Deadlines, session reminders"
          onPress={() => router.push("/settings/notifications")}
        />
        <LinkRow
          Icon={FingerprintPattern}
          label={biometry.name === "Face" ? "Face unlock" : "Fingerprint unlock"}
          hint={
            biometry.available
              ? "Ask for it before opening ALS"
              : "Not set up on this device"
          }
          toggle
          toggleValue={settings.biometricLock}
          onToggle={setLock}
        />
        <LinkRow
          Icon={ShieldCheck}
          label="Privacy"
          hint="What is stored, and where"
          onPress={() => router.push("/settings/privacy")}
          last
        />
      </View>

      <View>
        <LinkRow
          Icon={Trash2}
          label="Delete account"
          hint="Erases everything on this device"
          destructive
          onPress={() => setConfirming(true)}
          last
        />
      </View>

      <ConfirmDialog
        visible={Boolean(notice)}
        title="Not available"
        message={notice}
        confirmLabel="OK"
        onConfirm={() => setNotice(null)}
        onDismiss={() => setNotice(null)}
      />

      <ConfirmDialog
        visible={confirming}
        title="Delete your account?"
        message="This erases your profile, units, timetable, knowledge and chats from this device. It can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          resetEverything();
        }}
      />
    </Screen>
  );
}
