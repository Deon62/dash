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
import { deleteAccount, saveSettings } from "@/lib/account";

export default function SettingsScreen() {
  const router = useRouter();

  const settings = useStudyStore((state) => state.settings);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      saveSettings({ biometricLock: false });
      return;
    }

    if (!biometry.available) {
      setNotice("This device has no fingerprint or face unlock set up yet. Add one in your phone's settings first.");
      return;
    }

    const result = await authenticate("Turn on the lock for ALS");
    if (result.ok) saveSettings({ biometricLock: true });
  };

  /**
   * Deletes on the server first, then clears the handset.
   *
   * That order matters: wiping locally first would leave no token to
   * authenticate the deletion with, and the account would live on with nobody
   * able to reach it.
   */
  const removeAccount = async () => {
    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    setConfirming(false);

    if (error) setNotice(error);
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
          hint="Erases your account and everything on it"
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
        message="This erases your profile, units, timetable, knowledge and chats from our servers and from this phone. It can't be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={removeAccount}
      />
    </Screen>
  );
}
