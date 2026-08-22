import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Building2, GraduationCap, Mail, UserRound } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import Dropdown from "@/components/Dropdown";
import AvatarPicker from "@/components/AvatarPicker";
import { useStudyStore } from "@/store/useStudyStore";
import { SEMESTERS, YEARS } from "@/theme/units";
import { impact, notify } from "@/lib/haptics";

export const YEAR_OPTIONS = YEARS.map((year) => ({
  value: year,
  label: `Year ${year}`,
}));

export const SEMESTER_OPTIONS = SEMESTERS.map((semester) => ({
  value: semester,
  label: `Semester ${semester}`,
}));

export default function AccountScreen() {
  const router = useRouter();
  const profile = useStudyStore((state) => state.profile);
  const updateProfile = useStudyStore((state) => state.updateProfile);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [program, setProgram] = useState(profile.program);
  const [institution, setInstitution] = useState(profile.institution);
  const [year, setYear] = useState(profile.yearOfStudy ?? 1);
  const [semester, setSemester] = useState(profile.semester ?? 1);

  const dirty =
    name !== profile.name ||
    email !== profile.email ||
    program !== profile.program ||
    institution !== profile.institution ||
    year !== profile.yearOfStudy ||
    semester !== profile.semester;

  const save = () => {
    if (!dirty) return;
    impact("medium");
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      program: program.trim(),
      institution: institution.trim(),
      yearOfStudy: year,
      semester,
    });
    notify("success");
    router.back();
  };

  return (
    <Screen bare keyboardAware>
      <ScreenHeader
        title="Personal details"
        description="Your programme and year are what let the tutor talk about your studies in your own terms."
      />

      <View className="items-center">
        <AvatarPicker />
      </View>

      <View className="gap-y-4">
        <TextField
          label="FULL NAME"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          Icon={UserRound}
          autoCapitalize="words"
          autoComplete="name"
        />
        <TextField
          label="EMAIL"
          value={email}
          onChangeText={setEmail}
          placeholder="you@university.ac.ke"
          Icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="PROGRAMME"
          value={program}
          onChangeText={setProgram}
          placeholder="BSc Computer Science"
          Icon={GraduationCap}
          autoCapitalize="words"
        />
        <TextField
          label="INSTITUTION"
          value={institution}
          onChangeText={setInstitution}
          placeholder="University name"
          Icon={Building2}
          autoCapitalize="words"
        />

        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <Dropdown
              label="YEAR"
              sheetTitle="Year of study"
              value={year}
              onChange={setYear}
              options={YEAR_OPTIONS}
            />
          </View>
          <View className="flex-1">
            <Dropdown
              label="SEMESTER"
              sheetTitle="Semester"
              value={semester}
              onChange={setSemester}
              options={SEMESTER_OPTIONS}
            />
          </View>
        </View>
      </View>

      <Pressable
        onPress={save}
        disabled={!dirty}
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        accessibilityState={{ disabled: !dirty }}
        className={`items-center justify-center rounded-2xl py-4 ${
          dirty ? "bg-obsidian active:opacity-85" : "bg-surface"
        }`}
      >
        <Text
          className={`font-jk-med text-[15px] ${dirty ? "text-canvas" : "text-muted"}`}
        >
          Save changes
        </Text>
      </Pressable>
    </Screen>
  );
}
