import { useMemo } from "react";
import { Text, View } from "react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import { useStudyStore } from "@/store/useStudyStore";
import { MATERIAL_KINDS, kindLabel } from "@/theme/units";

function Row({ label, value, last = false }) {
  return (
    <View
      className={`flex-row items-center justify-between py-3.5 ${
        last ? "" : "border-b border-line"
      }`}
    >
      <Text className="font-jk text-ink text-[14.5px]">{label}</Text>
      <Text className="font-jk-med text-ink text-[14.5px]">{value}</Text>
    </View>
  );
}

/**
 * What the student has actually built up.
 *
 * Usage on a free, offline app is not a quota — it is a picture of how much of
 * the semester is in here, which is the number that tells them whether the
 * tutor has anything to work with.
 */
export default function UsageScreen() {
  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const chats = useStudyStore((state) => state.chats);
  const events = useStudyStore((state) => state.events);
  const study = useStudyStore((state) => state.study);

  const live = materials.filter((material) => !material.archived);

  const byKind = useMemo(() => {
    const table = new Map(MATERIAL_KINDS.map((kind) => [kind.key, 0]));
    for (const material of live) {
      table.set(material.kind, (table.get(material.kind) ?? 0) + 1);
    }
    return table;
  }, [live]);

  const words = useMemo(
    () =>
      live.reduce(
        (total, material) => total + material.body.split(/\s+/).filter(Boolean).length,
        0
      ),
    [live]
  );

  const questions = chats.reduce(
    (total, chat) => total + chat.messages.filter((m) => m.role === "student").length,
    0
  );

  return (
    <Screen bare>
      <ScreenHeader
        title="Usage"
        description="How much of your course is in here so far."
      />

      <View>
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
          KNOWLEDGE
        </Text>
        <Row label="Units" value={units.length} />
        <Row label="Items filed" value={live.length} />
        <Row label="Archived" value={materials.length - live.length} />
        {/* Words, not megabytes: the tutor searches text, so text is the
            capacity that actually matters here. */}
        <Row label="Words the tutor can read" value={words.toLocaleString()} last />
      </View>

      <View>
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
          BY FORMAT
        </Text>
        {MATERIAL_KINDS.map((kind, index) => (
          <Row
            key={kind.key}
            label={kindLabel(kind.key)}
            value={byKind.get(kind.key) ?? 0}
            last={index === MATERIAL_KINDS.length - 1}
          />
        ))}
      </View>

      <View>
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
          REVISION
        </Text>
        <Row label="Conversations" value={chats.length} />
        <Row label="Questions asked" value={questions} />
        <Row label="Events tracked" value={events.length} />
        <Row label="Current streak" value={`${study.streakDays} days`} last />
      </View>
    </Screen>
  );
}
