import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Archive, ChevronRight, FolderClosed, Plus } from "lucide-react-native";

import Screen from "@/components/Screen";
import IconButton from "@/components/IconButton";
import Fab from "@/components/Fab";
import { PillButton } from "@/components/Button";
import AddKnowledge from "@/components/AddKnowledge";
import LimitSheet from "@/components/LimitSheet";
import EmptyState from "@/components/EmptyState";
import { activeTier } from "@/lib/quota";
import { useStudyStore } from "@/store/useStudyStore";
import { fileMaterial } from "@/lib/knowledge";
import { COLORS, TINTS } from "@/theme/colors";
import { impact } from "@/lib/haptics";
import { pullSync } from "@/lib/sync";

/**
 * One unit in the library.
 *
 * No card, no colour, no spine — just the code, what is in it, and a rule
 * underneath. Six units in six tinted boxes reads as a dashboard; six lines
 * separated by hairlines reads as a contents page, which is what this is.
 */
function UnitRow({ unit, items, events, onPress, last }) {
  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${unit.code} ${unit.title}`}
      className={`flex-row items-center py-4 active:opacity-60 ${
        last ? "" : "border-b border-line"
      }`}
    >
      <View className="flex-1 pr-3">
        {/* The code carries the identity, so it gets the weight and the
            letter-spacing rather than a swatch of colour. */}
        <Text className="font-jk-semi text-ink text-[15px] tracking-[0.4px]">
          {unit.code}
        </Text>
        <Text numberOfLines={1} className="font-jk text-muted text-[13px] mt-1">
          {unit.title}
        </Text>
        <Text className="font-jk text-muted text-[12px] mt-1.5">
          {items} {items === 1 ? "item" : "items"}
          {events > 0 ? ` · ${events} due` : ""}
        </Text>
      </View>

      <ChevronRight size={17} color="#71717A" strokeWidth={1.8} />
    </Pressable>
  );
}

/**
 * The filing cabinet: everything the student owns, organised by unit.
 *
 * Nothing here talks to the tutor. A student comes to this tab to put material
 * in or to look it up; turning it into revision is the Study tab's job, and
 * keeping the two apart is what stops either becoming a junk drawer.
 */
export default function KnowledgeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const subscription = useStudyStore((state) => state.subscription);
  const usage = useStudyStore((state) => state.usage);
  // The server's scan meter where it has arrived. It is what the server will
  // actually refuse against, and it knows about a page scanned on another
  // handset — which the device's own tally, by definition, does not.
  const ocrMeter = useStudyStore((state) => state.serverUsage?.ocrPages ?? null);
  const events = useStudyStore((state) => state.events);

  const [adding, setAdding] = useState(false);
  const [blocked, setBlocked] = useState(null);

  const tier = activeTier(subscription);

  /**
   * Opens the add sheet once, on the way out of intake.
   *
   * `?start=1` is set by `useSessionGuard` and only on that one transition, so
   * this cannot fire on an ordinary visit. Filing the first thing is the step
   * that makes the app demonstrable, and a student who has just typed in six
   * unit codes should not have to find the button to prove it.
   *
   * The ref is what makes it once: the param survives in the URL, so without
   * it the sheet would reopen every time this tab regained focus.
   */
  const started = useRef(false);

  useEffect(() => {
    if (started.current || params.start !== "1") return;
    if (units.length === 0) return;

    started.current = true;
    setAdding(true);
  }, [params.start, units.length]);

  const counts = useMemo(() => {
    const table = new Map(units.map((unit) => [unit.id, { items: 0, events: 0 }]));

    for (const material of materials) {
      if (material.archived) continue;
      const row = table.get(material.unitId);
      if (row) row.items += 1;
    }
    for (const event of events) {
      const row = table.get(event.unitId);
      if (row && !event.done) row.events += 1;
    }

    return table;
  }, [units, materials, events]);

  return (
    <>
      <Screen fab onRefresh={pullSync}>
        <View className="flex-row items-start justify-between">
          {/* Title only. The counts were a caption nobody read, and the list
              underneath already says how much is in here. */}
          <Text className="font-jk-bold text-ink text-[30px] leading-[38px] flex-1 pr-3">
            Knowledge
          </Text>

          <IconButton
            Icon={Archive}
            label="Archived knowledge"
            onPress={() => router.push("/archive")}
          />
        </View>

        {units.length === 0 ? (
          <EmptyState
            Icon={FolderClosed}
            title="No units yet"
            message="Add a unit for each subject you're taking. Timetable, notes and deadlines all get filed underneath it."
            action={
              <PillButton label="Add a unit" Icon={Plus} onPress={() => router.push("/unit/new")} />
            }
          />
        ) : (
          <View>
            {units.map((unit, index) => {
              const row = counts.get(unit.id) ?? { items: 0, events: 0 };

              return (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  items={row.items}
                  events={row.events}
                  last={index === units.length - 1}
                  onPress={() => router.push(`/unit/${unit.id}`)}
                />
              );
            })}

            <Pressable
              onPress={() => {
                impact("light");
                router.push("/unit/new");
              }}
              accessibilityRole="button"
              accessibilityLabel="Add a unit"
              className="flex-row items-center py-4 active:opacity-60"
            >
              {/* Blue, where it was grey. This is the one thing to do on an
                  empty library, and it was drawn in the same tone as the
                  captions above it — the primary action reading as a caption
                  is how a page ends up looking like it has nothing to press. */}
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: TINTS.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={15} color={COLORS.primary} strokeWidth={2} />
              </View>
              <Text className="font-jk-med text-primary text-[14px] ml-2.5">
                Add a unit
              </Text>
            </Pressable>
          </View>
        )}
      </Screen>

      {/* Adding material is what happens most on this tab, so it gets the
          thumb-reachable corner rather than a control in the header. */}
      {units.length > 0 ? (
        <Fab label="Add knowledge" onPress={() => setAdding(true)} />
      ) : null}

      <LimitSheet verdict={blocked} onClose={() => setBlocked(null)} />

      <AddKnowledge
        visible={adding}
        units={units}
        tier={tier}
        usage={usage}
        ocrMeter={ocrMeter}
        onBlocked={setBlocked}
        onClose={() => setAdding(false)}
        // No dialog on a failed upload any more. The item is filed either way,
        // it carries its own "couldn't upload · retry" line inside the unit,
        // and the bell picks it up — three ways of noticing, none of which
        // stops a student who was about to add the next thing.
        onSave={fileMaterial}
      />
    </>
  );
}
