import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  ChartNoAxesColumn,
  IdCard,
  Layers,
  LogOut,
  Receipt,
  Settings,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import IconButton from "@/components/IconButton";
import AvatarPicker from "@/components/AvatarPicker";
import LinkRow from "@/components/LinkRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useStudyStore } from "@/store/useStudyStore";
import { activeTier } from "@/lib/quota";
import { planName } from "@/theme/plans";

export default function ProfileScreen() {
  const router = useRouter();

  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const profile = useStudyStore((state) => state.profile);
  const units = useStudyStore((state) => state.units);
  const classes = useStudyStore((state) => state.classes);
  const subscription = useStudyStore((state) => state.subscription);
  const signOut = useStudyStore((state) => state.signOut);

  const enrolment = [profile.program, profile.institution].filter(Boolean).join(" · ");
  const term = [
    profile.yearOfStudy ? `Year ${profile.yearOfStudy}` : null,
    profile.semester ? `Semester ${profile.semester}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen>
      <View className="flex-row justify-end">
        <IconButton
          Icon={Settings}
          label="Settings"
          onPress={() => router.push("/settings")}
        />
      </View>

      <View className="items-center -mt-4">
        <AvatarPicker />

        <Text className="font-jk-bold text-ink text-[22px] mt-5">
          {profile.name || "Your name"}
        </Text>
        {enrolment ? (
          <Text className="font-jk text-muted text-[13px] text-center mt-1">
            {enrolment}
          </Text>
        ) : null}
        <Text className="font-jk text-muted text-[12.5px] mt-1">
          {term || `Student since ${profile.memberSince}`}
        </Text>
      </View>

      {/* One continuous list. Splitting it into groups put a gap where a rule
          belongs, and the reader had to work out what the gap meant. */}
      <View>
        <LinkRow
          Icon={IdCard}
          label="Personal details"
          onPress={() => router.push("/account")}
        />
        <LinkRow
          Icon={Layers}
          label="Units"
          value={units.length ? String(units.length) : undefined}
          onPress={() => router.push("/units")}
        />
        <LinkRow
          Icon={CalendarDays}
          label="Class timetable"
          value={classes.length ? `${classes.length}/wk` : undefined}
          onPress={() => router.push("/timetable")}
        />
        <LinkRow
          Icon={ChartNoAxesColumn}
          label="Usage"
          onPress={() => router.push("/usage")}
        />
        <LinkRow
          Icon={Receipt}
          label="Billing"
          value={planName(activeTier(subscription))}
          onPress={() => router.push("/billing")}
        />
        <LinkRow
          Icon={LogOut}
          iconTone="danger"
          label="Log out"
          onPress={() => setConfirmingLogout(true)}
          last
        />
      </View>

      {/* Everything is on the phone, so this really is the whole account —
          worth saying plainly rather than implying a server holds a copy. */}
      <Text className="font-jk text-muted text-[11.5px] leading-[17px] -mt-4">
        Your coursework is stored on this device only. Logging out keeps it.
      </Text>

      {/* Signing out is cheap here — the coursework stays — but it still ends
          a session, and a mis-tap on the last row of a list should not do it. */}
      <ConfirmDialog
        visible={confirmingLogout}
        title="Log out?"
        message="Your units, notes and deadlines stay on this device. You can sign back in any time."
        confirmLabel="Log out"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false);
          signOut();
        }}
      />
    </Screen>
  );
}
