import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, FolderClosed, Plus } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import { PillButton } from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { useStudyStore } from "@/store/useStudyStore";
import { impact } from "@/lib/haptics";

/** Enrolment for the semester. The same list Knowledge browses, managed. */
export default function UnitsScreen() {
  const router = useRouter();

  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const sessions = useStudyStore((state) => state.sessions);

  return (
    <Screen bare>
      <ScreenHeader
        title="Units"
        right={
          <IconButton
            Icon={Plus}
            label="Add a unit"
            onPress={() => router.push("/unit/new")}
          />
        }
      />

      {units.length === 0 ? (
        <EmptyState
          Icon={FolderClosed}
          title="No units yet"
          message="Add one for each subject you're taking."
          action={
            <PillButton label="Add a unit" Icon={Plus} onPress={() => router.push("/unit/new")} />
          }
        />
      ) : (
        <View>
          {units.map((unit, index) => {
            const items = materials.filter(
              (material) => material.unitId === unit.id && !material.archived
            ).length;
            // Not `sessions`: naming it that shadows the store's list in this
            // same scope, so the filter reads the half-declared local instead
            // and the screen dies on `undefined.filter` for every unit.
            const weekly = sessions.filter((entry) => entry.unitId === unit.id).length;

            return (
              <Pressable
                key={unit.id}
                onPress={() => {
                  impact("light");
                  router.push(`/unit/${unit.id}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${unit.code} ${unit.title}`}
                className={`flex-row items-center py-4 active:opacity-60 ${
                  index === units.length - 1 ? "" : "border-b border-line"
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text className="font-jk-semi text-ink text-[15px] tracking-[0.4px]">
                    {unit.code}
                  </Text>
                  <Text numberOfLines={1} className="font-jk text-muted text-[13px] mt-1">
                    {unit.title}
                  </Text>
                  <Text className="font-jk text-muted text-[12px] mt-1.5">
                    {items} {items === 1 ? "item" : "items"} ·{" "}
                    {weekly} {weekly === 1 ? "session" : "sessions"} a week
                    {unit.lecturer ? ` · ${unit.lecturer}` : ""}
                  </Text>
                </View>

                <ChevronRight size={17} color="#71717A" strokeWidth={1.8} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
