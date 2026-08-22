import { useState } from "react";
import { Text, View } from "react-native";
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

export default function SettingsScreen() {
  const router = useRouter();

  const settings = useStudyStore((state) => state.settings);
  const updateSettings = useStudyStore((state) => state.updateSettings);
  const resetEverything = useStudyStore((state) => state.resetEverything);

  const [confirming, setConfirming] = useState(false);

  return (
    <Screen bare>
      <ScreenHeader title="Settings" />

      <View>
        <LinkRow
          Icon={BellRing}
          label="Notification preferences"
          hint="Deadlines, class reminders"
          onPress={() => router.push("/settings/notifications")}
        />
        <LinkRow
          Icon={FingerprintPattern}
          label="Biometrics"
          hint="Ask for a fingerprint before opening"
          toggle
          toggleValue={settings.biometricLock}
          onToggle={(biometricLock) => updateSettings({ biometricLock })}
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

      <Text className="font-jk text-muted text-[11.5px] leading-[17px] -mt-3">
        Biometrics is stored as a preference for now — the lock itself needs
        expo-local-authentication, which is not wired up yet.
      </Text>

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
