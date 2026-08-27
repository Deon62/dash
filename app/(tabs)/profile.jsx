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
import { endSession } from "@/lib/session";
import { activeTier } from "@/lib/quota";
import { planName } from "@/theme/plans";

export default function ProfileScreen() {
  const router = useRouter();

  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const profile = useStudyStore((state) => state.profile);
  const units = useStudyStore((state) => state.units);
  const sessions = useStudyStore((state) => state.sessions);
  const subscription = useStudyStore((state) => state.subscription);

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
          label="Timetable"
          value={sessions.length ? `${sessions.length}/wk` : undefined}
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

      {/* Nothing about syncing here. It is a background condition, not
          something this page is about, and a card wedged under the links was
          in the way on every visit for the sake of a state that is almost
          never true. It lives in Notifications now, with everything else the
          app has to say for itself. */}

      {/* Logging out clears this handset — the coursework is on the account,
          not here — so it is worth confirming rather than doing on a mis-tap
          against the last row of a list. */}
      <ConfirmDialog
        visible={confirmingLogout}
        title="Log out?"
        message="Your units, notes and deadlines stay on your account. Signing back in brings them down again."
        confirmLabel="Log out"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false);
          endSession();
        }}
      />
    </Screen>
  );
}
