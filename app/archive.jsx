import { Pressable, Text, View } from "react-native";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { formatDateTime } from "@/lib/dates";
import { kindLabel } from "@/theme/units";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * Everything archived out of Knowledge.
 *
 * Archiving is the default way to clear a unit, so this is where last
 * semester's material ends up — findable, out of the tutor's reach, and one
 * tap from coming back.
 */
export default function ArchiveScreen() {
  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const archiveMaterial = useStudyStore((state) => state.archiveMaterial);
  const removeMaterial = useStudyStore((state) => state.removeMaterial);

  const archived = materials.filter((material) => material.archived);

  return (
    <Screen bare>
      <ScreenHeader title="Archive" />

      {archived.length === 0 ? (
        <EmptyState
          Icon={Archive}
          title="Nothing archived"
          message="Archive a note from its unit when you're done with it and it lands here."
        />
      ) : (
        <View>
          {archived.map((material, index) => {
            const unit = unitById(units, material.unitId);

            return (
              <View
                key={material.id}
                className={`flex-row items-center py-4 ${
                  index === archived.length - 1 ? "" : "border-b border-line"
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text className="font-jk text-muted text-[11.5px]">
                    {[unit?.code, kindLabel(material.kind), formatDateTime(material.addedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text
                    numberOfLines={2}
                    className="font-jk-med text-ink text-[14.5px] leading-[20px] mt-1"
                  >
                    {material.title}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    impact("light");
                    archiveMaterial(material.id, false);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${material.title}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: COLORS.surface,
                  }}
                  className="active:opacity-60"
                >
                  <ArchiveRestore size={16} color={COLORS.ink} strokeWidth={1.8} />
                </Pressable>

                <Pressable
                  onPress={() => {
                    impact("light");
                    removeMaterial(material.id);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${material.title} for good`}
                  className="h-9 w-9 items-center justify-center rounded-full ml-2 active:bg-surface"
                >
                  <Trash2 size={16} color={COLORS.danger} strokeWidth={1.8} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
