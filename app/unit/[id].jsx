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
import ClassRow from "@/components/ClassRow";
import EventRow from "@/components/EventRow";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import AddKnowledge from "@/components/AddKnowledge";
import LimitSheet from "@/components/LimitSheet";
import EventComposer from "@/components/EventComposer";
import ClassComposer from "@/components/ClassComposer";
import { activeTier } from "@/lib/quota";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { DAYS, kindLabel, weekOrder } from "@/theme/units";
import { formatDateTime, minutesOf } from "@/lib/dates";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

const SECTIONS = [
  { value: "knowledge", label: "Knowledge" },
  { value: "events", label: "Deadlines" },
  { value: "times", label: "Class times" },
];

export default function UnitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const unitId = String(id);

  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const subscription = useStudyStore((state) => state.subscription);
  const events = useStudyStore((state) => state.events);
  const classes = useStudyStore((state) => state.classes);

  const addMaterial = useStudyStore((state) => state.addMaterial);
  const archiveMaterial = useStudyStore((state) => state.archiveMaterial);
  const addEvent = useStudyStore((state) => state.addEvent);
  const toggleEvent = useStudyStore((state) => state.toggleEvent);
  const removeEvent = useStudyStore((state) => state.removeEvent);
  const addClass = useStudyStore((state) => state.addClass);
  const removeClass = useStudyStore((state) => state.removeClass);
  const removeUnit = useStudyStore((state) => state.removeUnit);

  const [section, setSection] = useState("knowledge");
  const [composer, setComposer] = useState(null);
  const [blocked, setBlocked] = useState(null);

  const tier = activeTier(subscription);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const unit = unitById(units, unitId);

  const unitMaterials = useMemo(
    () => materials.filter((material) => material.unitId === unitId && !material.archived),
    [materials, unitId]
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
  const unitClasses = useMemo(
    () =>
      classes
        .filter((entry) => entry.unitId === unitId)
        .sort(
          (a, b) =>
            weekOrder(a.day) - weekOrder(b.day) || minutesOf(a.start) - minutesOf(b.start)
        ),
    [classes, unitId]
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
        : "Add a class time";

  return (
    <>
      <Screen bare>
        <ScreenHeader
          right={
            <IconButton
              Icon={Trash2}
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
                  : `${unitClasses.length} a week`,
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
              message="Notes, slides, readings — anything with text in it is what the tutor revises with you."
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
                    <View className="flex-1 pr-2">
                      <Text className="font-jk text-muted text-[11.5px]">
                        {kindLabel(material.kind)} · {formatDateTime(material.addedAt)}
                      </Text>
                      <Text className="font-jk-med text-ink text-[14.5px] leading-[20px] mt-1">
                        {material.title}
                      </Text>
                    </View>

                    {/* Archive, not delete. A student clearing clutter should
                        not be one tap from losing a semester of notes. */}
                    <Pressable
                      onPress={() => {
                        impact("light");
                        archiveMaterial(material.id);
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

                  {material.uri && material.kind === "pdf" ? (
                    <Text className="font-jk text-muted text-[12px] mt-2">
                      PDF attached — its text can't be searched until extraction
                      is wired up.
                    </Text>
                  ) : null}
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

        {/* --- Class times --- */}
        {section === "times" ? (
          unitClasses.length === 0 ? (
            <EmptyState
              Icon={CalendarClock}
              title="No class times"
              message="Add when this unit meets and today's sessions appear on Home automatically."
            />
          ) : (
            <View>
              {unitClasses.map((entry, index) => (
                <View key={entry.id}>
                  <Text className="font-jk text-muted text-[11px] tracking-[0.8px] mt-2">
                    {DAYS.find((day) => day.index === entry.day)?.long.toUpperCase()}
                  </Text>
                  <ClassRow
                    entry={entry}
                    unit={unit}
                    today={entry.day === new Date().getDay()}
                    onRemove={() => removeClass(entry.id)}
                    last={index === unitClasses.length - 1}
                  />
                </View>
              ))}
            </View>
          )
        ) : null}
      </Screen>

      <LimitSheet verdict={blocked} onClose={() => setBlocked(null)} />

      <AddKnowledge
        visible={composer === "knowledge"}
        units={units}
        tier={tier}
        onBlocked={setBlocked}
        lockedUnitId={unitId}
        onClose={() => setComposer(null)}
        onSave={addMaterial}
      />
      <EventComposer
        visible={composer === "events"}
        units={units}
        lockedUnitId={unitId}
        onClose={() => setComposer(null)}
        onSave={(payload) => addEvent({ ...payload, unitId })}
      />
      <ClassComposer
        visible={composer === "times"}
        units={units}
        lockedUnitId={unitId}
        onClose={() => setComposer(null)}
        onSave={(payload) => addClass({ ...payload, unitId })}
      />

      <ConfirmDialog
        visible={confirmingDelete}
        title={`Delete ${unit.code}?`}
        message="Its knowledge, deadlines and class times go with it. This can't be undone."
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
