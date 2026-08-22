import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  GraduationCap,
  Plus,
  UserRound,
  X,
} from "lucide-react-native";

import TextField from "@/components/TextField";
import Dropdown from "@/components/Dropdown";
import { useStudyStore } from "@/store/useStudyStore";
import { SEMESTERS, YEARS } from "@/theme/units";
import { impact, notify } from "@/lib/haptics";

const YEAR_OPTIONS = YEARS.map((year) => ({ value: year, label: `Year ${year}` }));
const SEMESTER_OPTIONS = SEMESTERS.map((semester) => ({
  value: semester,
  label: `Semester ${semester}`,
}));

/**
 * Intake, in two steps: who you are, then what you're taking.
 *
 * Split rather than one long form because the second step is a repeating one —
 * a student adds four to eight units — and mixing a repeating list into a form
 * makes both feel unfinished.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();

  const units = useStudyStore((state) => state.units);
  const addUnit = useStudyStore((state) => state.addUnit);
  const removeUnit = useStudyStore((state) => state.removeUnit);
  const completeOnboarding = useStudyStore((state) => state.completeOnboarding);

  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState(1);
  const [semester, setSemester] = useState(1);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");

  const canContinue = name.trim().length > 1 && program.trim().length > 1;
  const canAddUnit = code.trim().length >= 2 && title.trim().length >= 2;

  const submitUnit = () => {
    if (!canAddUnit) return;
    impact("medium");
    addUnit({ code, title });
    setCode("");
    setTitle("");
  };

  const finish = () => {
    impact("medium");
    notify("success");
    completeOnboarding({
      name: name.trim(),
      institution: institution.trim(),
      program: program.trim(),
      yearOfStudy: year,
      semester,
    });
    // No navigation — the session guard moves us into the tabs once
    // `onboarded` flips.
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-canvas"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        {step === 1 ? (
          <Pressable
            onPress={() => {
              impact("light");
              setStep(0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-60 mb-5"
          >
            <ArrowLeft size={18} color="#09090B" strokeWidth={1.8} />
          </Pressable>
        ) : null}

        {/* Progress — two rules, because two steps do not need a bar. */}
        <View className="flex-row gap-x-1.5">
          {[0, 1].map((index) => (
            <View
              key={index}
              className={`h-0.5 flex-1 rounded-full ${
                index <= step ? "bg-primary" : "bg-line"
              }`}
            />
          ))}
        </View>

        {step === 0 ? (
          <>
            <Text className="font-jk-bold text-ink text-[28px] leading-[35px] mt-8">
              Tell us about{"\n"}your course
            </Text>
            <Text className="font-jk text-muted text-[13.5px] leading-[20px] mt-2.5">
              This is what lets the tutor talk about your studies in your own
              terms.
            </Text>

            <View className="gap-y-4 mt-8">
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
              onPress={() => {
                if (!canContinue) return;
                impact("medium");
                setStep(1);
              }}
              disabled={!canContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !canContinue }}
              className={`flex-row items-center justify-center gap-x-2 rounded-2xl py-4 mt-8 ${
                canContinue ? "bg-primary active:opacity-85" : "bg-surface"
              }`}
            >
              <Text
                className={`font-jk-med text-[15px] ${
                  canContinue ? "text-canvas" : "text-muted"
                }`}
              >
                Continue
              </Text>
              {canContinue ? (
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={1.8} />
              ) : null}
            </Pressable>
          </>
        ) : (
          <>
            <Text className="font-jk-bold text-ink text-[28px] leading-[35px] mt-8">
              What are you taking{"\n"}this semester?
            </Text>
            <Text className="font-jk text-muted text-[13.5px] leading-[20px] mt-2.5">
              Add a unit for each subject. You can add more, or drop one, at any
              time.
            </Text>

            <View className="gap-y-4 mt-8">
              <TextField
                label="UNIT CODE"
                value={code}
                onChangeText={setCode}
                placeholder="CS201"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
              />
              <TextField
                label="UNIT NAME"
                value={title}
                onChangeText={setTitle}
                placeholder="Data Structures and Algorithms"
                autoCapitalize="words"
                onSubmitEditing={submitUnit}
                returnKeyType="done"
              />
            </View>

            <Pressable
              onPress={submitUnit}
              disabled={!canAddUnit}
              accessibilityRole="button"
              accessibilityLabel="Add unit"
              accessibilityState={{ disabled: !canAddUnit }}
              className={`flex-row items-center justify-center gap-x-2 rounded-2xl border border-line py-3.5 mt-5 ${
                canAddUnit ? "active:bg-surface" : "opacity-40"
              }`}
            >
              <Plus size={15} color="#09090B" strokeWidth={1.8} />
              <Text className="font-jk-med text-ink text-[14px]">Add unit</Text>
            </Pressable>

            {units.length > 0 ? (
              <View className="mt-6">
                {units.map((unit, index) => (
                  <View
                    key={unit.id}
                    className={`flex-row items-center py-3.5 ${
                      index === units.length - 1 ? "" : "border-b border-line"
                    }`}
                  >
                    <Text className="font-jk-semi text-ink text-[14px] w-[74px]">
                      {unit.code}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="font-jk text-muted text-[13px] flex-1"
                    >
                      {unit.title}
                    </Text>
                    <Pressable
                      onPress={() => {
                        impact("light");
                        removeUnit(unit.id);
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${unit.code}`}
                      className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
                    >
                      <X size={15} color="#71717A" strokeWidth={1.8} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="mt-auto pt-10">
              <Pressable
                onPress={finish}
                accessibilityRole="button"
                accessibilityLabel={units.length === 0 ? "Skip for now" : "Finish setup"}
                className="items-center justify-center rounded-2xl bg-primary py-4 active:opacity-85"
              >
                <Text className="font-jk-med text-canvas text-[15px]">
                  {units.length === 0 ? "Skip for now" : "Done"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
