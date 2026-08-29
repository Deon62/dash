import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Archive,
  CalendarClock,
  FileText,
  ListTodo,
  Orbit,
  Plus,
  Trash2,
} from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import IconButton from "@/components/IconButton";
import Disc from "@/components/Disc";
import Dropdown from "@/components/Dropdown";
import SessionRow from "@/components/SessionRow";
import EventRow from "@/components/EventRow";
import EmptyState from "@/components/EmptyState";
import UndoBar from "@/components/UndoBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import AddKnowledge from "@/components/AddKnowledge";
import LimitSheet from "@/components/LimitSheet";
import EventComposer from "@/components/EventComposer";
import SessionComposer from "@/components/SessionComposer";
import { activeTier } from "@/lib/quota";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import UploadStatus from "@/components/UploadStatus";
import { fileMaterial, openMaterial } from "@/lib/knowledge";
import { DAYS, kindLabel, weekOrder } from "@/theme/units";
import { formatDateTime, minutesOf } from "@/lib/dates";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";
import { pullSync } from "@/lib/sync";
import { useUndoable } from "@/lib/useUndoable";

const SECTIONS = [
  { value: "knowledge", label: "Knowledge" },
  { value: "events", label: "Deadlines" },
  { value: "times", label: "Session times" },
];

export default function UnitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const unitId = String(id);

  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const subscription = useStudyStore((state) => state.subscription);
  const events = useStudyStore((state) => state.events);
  const sessions = useStudyStore((state) => state.sessions);


  const archiveMaterial = useStudyStore((state) => state.archiveMaterial);
  const addEvent = useStudyStore((state) => state.addEvent);
  const toggleEvent = useStudyStore((state) => state.toggleEvent);
  const removeEvent = useStudyStore((state) => state.removeEvent);
  const addSession = useStudyStore((state) => state.addSession);
  const removeSession = useStudyStore((state) => state.removeSession);
  const removeUnit = useStudyStore((state) => state.removeUnit);

  const [section, setSection] = useState("knowledge");
  const [composer, setComposer] = useState(null);
  const [blocked, setBlocked] = useState(null);

  const tier = activeTier(subscription);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const unit = unitById(units, unitId);

  /**
   * Archiving is already reversible — the Archive screen restores in one tap —
   * but only if you know that screen exists, and nothing on this row says so.
   * The strip is really a disclosure: it names what happened and offers the
   * way back, in the two seconds when the student is still looking at the gap
   * the row left behind.
   */
  const filed = useUndoable((material) => archiveMaterial(material.id));

  const unitMaterials = useMemo(
    () =>
      materials.filter(
        (material) =>
          material.unitId === unitId &&
          !material.archived &&
          material.id !== filed.hiddenId,
      ),
    [materials, unitId, filed.hiddenId]
  );
  const unitEvents = useMemo(
    () =>
      events
        .filter((event) => event.unitId === unitId)
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return (a.at ?? "9999").localeCompare(b.at ?? "9999");
        }),
    [events, unitId]
  );
  const unitSessions = useMemo(
    () =>
      sessions
        .filter((entry) => entry.unitId === unitId)
        .sort(
          (a, b) =>
            weekOrder(a.day) - weekOrder(b.day) || minutesOf(a.start) - minutesOf(b.start)
        ),
    [sessions, unitId]
  );

  // The unit can vanish under us — deleting it leaves this screen mounted for
  // one frame while the router pops.
  if (!unit) {
    return (
      <Screen bare>
        <ScreenHeader title="Unit not found" />
      </Screen>
    );
  }

  const addLabel =
    section === "knowledge"
      ? "Add knowledge"
      : section === "events"
        ? "Add a deadline"
        : "Add a session time";

  return (
    <>
      <Screen bare onRefresh={pullSync}>
        <ScreenHeader
          right={
            <IconButton
              Icon={Trash2}
              glyphTone="danger"
              label={`Delete ${unit.code}`}
              onPress={() => setConfirmingDelete(true)}
            />
          }
        />

        <View className="-mt-4">
          <Text className="font-jk-bold text-ink text-[30px] leading-[37px] tracking-[0.4px]">
            {unit.code}
          </Text>
          <Text className="font-jk text-muted text-[14px] leading-[20px] mt-1.5">
            {unit.title}
            {unit.lecturer ? ` · ${unit.lecturer}` : ""}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            impact("medium");
            router.push({ pathname: "/study", params: { unitId } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Revise ${unit.code}`}
          className="flex-row items-center justify-center gap-x-2 rounded-full bg-primary py-3.5 active:opacity-85"
        >
          <Orbit size={16} color="#FFFFFF" strokeWidth={1.8} />
          <Text className="font-jk-med text-canvas text-[14.5px]">
            Revise this unit
          </Text>
        </Pressable>

        {/* One dropdown instead of three tabs: the sections are alternatives,
            not a toolbar, and a closed field says which one you are in. */}
        <Dropdown
          value={section}
          onChange={setSection}
          options={SECTIONS.map((option) => ({
            ...option,
            hint:
              option.value === "knowledge"
                ? `${unitMaterials.length} filed`
                : option.value === "events"
                  ? `${unitEvents.filter((event) => !event.done).length} open`
                  : `${unitSessions.length} a week`,
          }))}
          sheetTitle="Show"
        />

        <Pressable
          onPress={() => {
            impact("medium");
            setComposer(section);
          }}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          className="flex-row items-center gap-x-2 active:opacity-60"
        >
          <Disc size={32}>
            <Plus size={16} color={COLORS.ink} strokeWidth={1.8} />
          </Disc>
          <Text className="font-jk-med text-ink text-[14px]">{addLabel}</Text>
        </Pressable>

        {/* --- Knowledge --- */}
        {section === "knowledge" ? (
          unitMaterials.length === 0 ? (
            <EmptyState
              Icon={FileText}
              title="Nothing filed yet"
              message="Notes, slides, readings. Anything with text in it is what the tutor revises with you."
            />
          ) : (
            <View>
              {unitMaterials.map((material, index) => (
                <View
                  key={material.id}
                  className={`py-4 ${
                    index === unitMaterials.length - 1 ? "" : "border-b border-line"
                  }`}
                >
                  <View className="flex-row items-start">
                    {/* Tapping it opens the file, where there is one stored.
                        That used to hang off the status caption underneath,
                        which made the way to read your own PDF a line of grey
                        text that looked like a date. A typed note has nothing
                        to open, so it is not pressable and does not pretend to
                        be. */}
                    <Pressable
                      onPress={() => {
                        if (!hasFile(material)) return;
                        impact("light");
                        openMaterial(material.id);
                      }}
                      disabled={!hasFile(material)}
                      accessibilityRole={hasFile(material) ? "button" : "text"}
                      accessibilityLabel={
                        hasFile(material) ? `Open ${material.title}` : material.title
                      }
                      className="flex-1 pr-2 active:opacity-60"
                    >
                      <Text className="font-jk text-muted text-[11.5px]">
                        {kindLabel(material.kind)} · {formatDateTime(material.addedAt)}
                      </Text>
                      <Text className="font-jk-med text-ink text-[14.5px] leading-[20px] mt-1">
                        {material.title}
                      </Text>
                    </Pressable>

                    {/* Archive, not delete. A student clearing clutter should
                        not be one tap from losing a semester of notes. */}
                    <Pressable
                      onPress={() => {
                        impact("light");
                        filed.remove(material, `Archived “${material.title}”`);
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Archive ${material.title}`}
                      className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
                    >
                      <Archive size={15} color="#71717A" strokeWidth={1.8} />
                    </Pressable>
                  </View>

                  {material.kind === "image" && material.uri ? (
                    <Image
                      source={{ uri: material.uri }}
                      style={{ width: "100%", height: 170, borderRadius: 14 }}
                      resizeMode="cover"
                      className="mt-3"
                    />
                  ) : null}

                  {material.body ? (
                    <Text
                      numberOfLines={4}
                      className="font-jk text-muted text-[13px] leading-[19px] mt-2"
                    >
                      {material.body}
                    </Text>
                  ) : null}

                  {/* Where the file has got to. Silent once it is readable —
                      a line saying "ready" on every item is furniture. */}
                  <UploadStatus material={material} />
                </View>
              ))}
            </View>
          )
        ) : null}

        {/* --- Deadlines --- */}
        {section === "events" ? (
          unitEvents.length === 0 ? (
            <EmptyState
              Icon={ListTodo}
              title="Nothing due"
              message="Add coursework with a date and it shows up on Home before it catches you out."
            />
          ) : (
            <View>
              {unitEvents.map((event, index) => (
                <EventRow
                  key={event.id}
                  event={event}
                  unit={unit}
                  onToggle={() => toggleEvent(event.id)}
                  onRemove={() => removeEvent(event.id)}
                  last={index === unitEvents.length - 1}
                />
              ))}
            </View>
          )
        ) : null}

        {/* --- Session times --- */}
        {section === "times" ? (
          unitSessions.length === 0 ? (
            <EmptyState
              Icon={CalendarClock}
              title="No session times"
              message="Add when this unit meets and today's sessions appear on Home automatically."
            />
          ) : (
            <View>
              {unitSessions.map((entry, index) => (
                <View key={entry.id}>
                  <Text className="font-jk text-muted text-[11px] tracking-[0.8px] mt-2">
                    {DAYS.find((day) => day.index === entry.day)?.long.toUpperCase()}
                  </Text>
                  <SessionRow
                    entry={entry}
                    unit={unit}
                    today={entry.day === new Date().getDay()}
                    onRemove={() => removeSession(entry.id)}
                    last={index === unitSessions.length - 1}
                  />
                </View>
              ))}
            </View>
          )
        ) : null}
      </Screen>

      {/* Outside `Screen`, which is a ScrollView — an absolutely-positioned
          child of one scrolls away with the content. */}
      <UndoBar pending={filed.pending} onUndo={filed.undo} />

      <LimitSheet verdict={blocked} onClose={() => setBlocked(null)} />

      <AddKnowledge
        visible={composer === "knowledge"}
        units={units}
        tier={tier}
        onBlocked={setBlocked}
        lockedUnitId={unitId}
        onClose={() => setComposer(null)}
        onSave={(payload) => fileMaterial({ ...payload, unitId })}
      />
      <EventComposer
        visible={composer === "events"}
        units={units}
        lockedUnitId={unitId}
        onClose={() => setComposer(null)}
        onSave={(payload) => addEvent({ ...payload, unitId })}
      />
      <SessionComposer
        visible={composer === "times"}
        units={units}
        lockedUnitId={unitId}
        onClose={() => setComposer(null)}
        onSave={(payload) => addSession({ ...payload, unitId })}
      />

      <ConfirmDialog
        visible={confirmingDelete}
        title={`Delete ${unit.code}?`}
        message="Its knowledge, deadlines and session times go with it. This can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          removeUnit(unitId);
          router.back();
        }}
      />
    </>
  );
}

/**
 * Whether there is something to open.
 *
 * A file the server has taken, or one still sitting on this phone. Not one
 * that failed to upload and was never on the handset either — a download URL
 * for that resolves to nothing, and a tap that opens an empty browser tab is
 * worse than a tap that does nothing at all.
 */
const STORED = new Set(["ready", "pending", "unreadable"]);

function hasFile(material) {
  if (material.kind === "note" || material.kind === "link") return false;
  // `unreadable` counts: the file is in the bucket and opens fine, it is only
  // its *text* that could not be extracted.
  return Boolean(material.uri) || STORED.has(material.uploadStatus);
}
