import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check,
  ChevronDown,
  Eye,
  MessageSquare,
  PanelLeft,
  RotateCcw,
  SquarePen,
  Trash2,
} from "lucide-react-native";

import Sheet from "@/components/Sheet";
import LimitSheet from "@/components/LimitSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import IconButton from "@/components/IconButton";
import Disc from "@/components/Disc";
import EmptyState from "@/components/EmptyState";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { answer, buildFlashcards, buildQuiz } from "@/lib/tutor";
import { formatDateTime, greeting } from "@/lib/dates";
import { getTabBarHeight } from "@/theme/layout";
import { useKeyboard } from "@/lib/useKeyboardVisible";
import {
  activeTier,
  aiQueriesLeft,
  canAskAi,
  canStartQuiz,
  citationDepth,
  quizSize,
} from "@/lib/quota";
import { COLORS } from "@/theme/colors";
import { useDictation } from "@/lib/useDictation";
import { MicGlyph, SendGlyph } from "@/components/Glyph";
import { impact, notify } from "@/lib/haptics";

const MODES = [
  { key: "ask", label: "Ask", hint: "Answers drawn from your notes" },
  { key: "quiz", label: "Quiz", hint: "Fill-in questions from your notes" },
  { key: "cards", label: "Cards", hint: "Flip through what you filed" },
];

/**
 * The tutor.
 *
 * Deliberately the quietest screen in the app: no title, no tabs, no counters.
 * A blank page with one question on it is what makes a student type; a
 * dashboard is what makes them close the app. Everything else — which unit is
 * in scope, which mode is running — lives behind the pill above the composer,
 * one tap away and out of the way until then.
 */
export default function StudyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const profile = useStudyStore((state) => state.profile);
  const units = useStudyStore((state) => state.units);
  const materials = useStudyStore((state) => state.materials);
  const chats = useStudyStore((state) => state.chats);
  const activeChatId = useStudyStore((state) => state.activeChatId);
  const newChat = useStudyStore((state) => state.newChat);
  const selectChat = useStudyStore((state) => state.selectChat);
  const setChatUnit = useStudyStore((state) => state.setChatUnit);
  const appendMessage = useStudyStore((state) => state.appendMessage);
  const deleteChat = useStudyStore((state) => state.deleteChat);
  const recordStudy = useStudyStore((state) => state.recordStudy);
  const subscription = useStudyStore((state) => state.subscription);
  const usage = useStudyStore((state) => state.usage);
  const recordAiQuery = useStudyStore((state) => state.recordAiQuery);
  const recordQuiz = useStudyStore((state) => state.recordQuiz);

  const [mode, setMode] = useState("ask");
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  /** A `{ reason, detail }` verdict from the quota layer, or null. */
  const [blocked, setBlocked] = useState(null);

  const scrollRef = useRef(null);

  // The composer is lifted by hand rather than by KeyboardAvoidingView: with
  // edge-to-edge on, Android never resizes the window for the keyboard, so the
  // KAV had nothing to react to and the field stayed underneath it. Below the
  // keyboard sits the tab bar's reserved strip — but only while the bar is
  // there, and it hides itself when the keyboard is up.
  const keyboard = useKeyboard();

  const chat = chats.find((entry) => entry.id === activeChatId) ?? null;
  const unitId = chat?.unitId ?? null;
  const unit = unitById(units, unitId);

  // A unit handed over from Knowledge opens a fresh conversation scoped to it,
  // rather than silently re-pointing whatever chat happened to be open.
  useEffect(() => {
    if (params.unitId) newChat(String(params.unitId));
  }, [params.unitId, newChat]);

  const scoped = useMemo(
    () =>
      materials.filter(
        (material) => !material.archived && (!unitId || material.unitId === unitId)
      ),
    [materials, unitId]
  );

  const messages = chat?.messages ?? [];

  // What the current plan allows. Read before `ask` is defined, because `ask`
  // closes over all three.
  const tier = activeTier(subscription);
  const depth = citationDepth(tier);
  const left = aiQueriesLeft(tier, usage);

  const ask = (question) => {
    const text = question.trim();
    if (!text || thinking) return;

    // The daily allowance is checked before the question is posted, not after:
    // showing a student's own words in the thread and then refusing to answer
    // them reads as a failure rather than a limit.
    const allowance = canAskAi(tier, usage);
    if (!allowance.ok) {
      setBlocked(allowance);
      return;
    }

    impact("medium");
    const target = chat ?? newChat(unitId);

    appendMessage(target.id, { role: "student", text });
    setDraft("");
    setThinking(true);
    recordStudy();
    recordAiQuery();

    // Retrieval is synchronous and instant. The pause is deliberate: a reply
    // that lands before the student's own message has finished animating in
    // reads as a canned response rather than an answer.
    setTimeout(() => {
      const reply = answer(text, { materials: scoped, unit, limit: depth });
      appendMessage(target.id, {
        role: "tutor",
        text: reply.text,
        sources: reply.sources.map((source) => source.title),
      });
      setThinking(false);
    }, 400);
  };

  const scopeLabel = `${unit ? unit.code : "All units"} · ${
    MODES.find((option) => option.key === mode)?.label
  }`;

  const firstName = profile.name.trim().split(/\s+/)[0];

  /** Something to send, and nothing already in flight. */
  const armed = draft.trim().length > 0 && !thinking;

  // Dictation writes straight into the draft, so a student can speak a
  // sentence and then fix a word by typing without losing either.
  const dictation = useDictation({ onText: setDraft });
  const listening = dictation.listening;

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-canvas">
      {/* --- Chrome. No title: the page is the conversation. --- */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <IconButton
          Icon={PanelLeft}
          label="Previous chats"
          onPress={() => setDrawerOpen(true)}
        />
        <IconButton
          Icon={SquarePen}
          label="New chat"
          onPress={() => {
            newChat(unitId);
            setDraft("");
          }}
        />
      </View>

      {mode === "ask" ? (
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={() =>
            messages.length > 0 && scrollRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 16,
            rowGap: 14,
            flexGrow: 1,
            justifyContent: messages.length === 0 ? "center" : "flex-start",
          }}
        >
          {messages.length === 0 ? (
            <View className="items-center px-4 -mt-16">
              <Text className="font-jk-semi text-ink text-[23px] leading-[29px] text-center">
                {greeting()},
              </Text>
              <Text className="font-jk-bold text-ink text-[30px] leading-[38px] text-center">
                {firstName ? `${firstName} 👋` : "ready when you are 👋"}
              </Text>

              {/* Naming what it has actually read is the whole promise of the
                  app, and this is the moment a student is deciding whether to
                  trust it. An empty library gets the one line it can act on. */}
              <Text className="font-jk text-muted text-[13.5px] leading-[20px] text-center mt-3">
                {scoped.length === 0
                  ? "Drop a note into Knowledge and I'll revise it with you."
                  : `I've read your ${scoped.length} filed ${
                      scoped.length === 1 ? "item" : "items"
                    }${unit ? ` for ${unit.code}` : ""}. Ask me anything in there.`}
              </Text>
            </View>
          ) : (
            messages.map((message) => <Bubble key={message.id} message={message} />)
          )}

          {thinking ? (
            <View className="self-start rounded-2xl bg-surface px-4 py-3">
              <Text className="font-jk text-muted text-[13.5px]">
                Reading your notes…
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : mode === "quiz" ? (
        <QuizPane
          materials={scoped}
          unit={unit}
          tier={tier}
          usage={usage}
          onStart={recordQuiz}
          onBlocked={setBlocked}
        />
      ) : (
        <CardsPane materials={scoped} units={units} unit={unit} />
      )}

      {/* --- Composer --- */}
      <View
        style={{
          paddingBottom: keyboard.visible
            ? keyboard.height + 10
            : getTabBarHeight(insets) + 8,
        }}
        className="px-5 pt-2"
      >
        <View className="rounded-3xl border border-line bg-canvas px-4 py-3">
          {mode === "ask" ? (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={
                listening
                  ? "Listening…"
                  : unit
                    ? `Ask about ${unit.code}`
                    : "Ask about your course"
              }
              placeholderTextColor="#A1A1AA"
              multiline
              // Three lines then scroll: a taller box eats the conversation it
              // is meant to be part of.
              style={{ maxHeight: 110, width: "100%" }}
              className="font-jk text-ink text-[15.5px] leading-[22px] py-1"
            />
          ) : (
            <Text className="font-jk text-muted text-[15px] py-1">
              {MODES.find((option) => option.key === mode)?.hint}
            </Text>
          )}

          {/* Everything you can act on sits on one line under the field: the
              scope on the left, the controls on the right. The send button
              beside the input drifted up and down as the field grew. */}
          <View className="flex-row items-center justify-between mt-3">
            <Pressable
              onPress={() => {
                impact("light");
                setScopeOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Scope: ${scopeLabel}. Change unit or mode`}
              className="flex-row items-center gap-x-1.5 rounded-full bg-surface px-3 py-1.5 active:opacity-60"
            >
              <Text className="font-jk-med text-ink text-[12.5px]">{scopeLabel}</Text>
              <ChevronDown size={14} color={COLORS.muted} strokeWidth={1.8} />
            </Pressable>

            {mode === "ask" ? (
              <View className="flex-row items-center gap-x-2">
                <Pressable
                  onPress={() => {
                    impact("light");
                    dictation.toggle(draft);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={listening ? "Stop dictating" : "Speak your question"}
                  accessibilityState={{ selected: listening }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    flexGrow: 0,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: listening ? COLORS.danger : COLORS.surface,
                  }}
                  className="active:opacity-70"
                >
                  <MicGlyph
                    size={19}
                    color={
                      listening
                        ? COLORS.canvas
                        : dictation.available
                          ? COLORS.ink
                          : COLORS.muted
                    }
                  />
                </Pressable>

                <Pressable
                  onPress={() => ask(draft)}
                  disabled={!armed}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  accessibilityState={{ disabled: !armed }}
                  // Fixed and unshrinkable, so nothing the field does can
                  // squeeze it out of the row.
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    flexGrow: 0,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: armed ? COLORS.primary : COLORS.surface,
                  }}
                  className="active:opacity-85"
                >
                  <SendGlyph size={19} color={armed ? COLORS.canvas : COLORS.muted} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* --- Previous chats --- */}
      <Sheet
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Chats"
      >
        <Pressable
          onPress={() => {
            impact("light");
            newChat(unitId);
            setDrawerOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          className="flex-row items-center py-3.5 border-b border-line active:opacity-60"
        >
          <Disc size={36}>
            <SquarePen size={16} color={COLORS.ink} strokeWidth={1.8} />
          </Disc>
          <Text className="font-jk-med text-ink text-[15px] ml-3.5">New chat</Text>
        </Pressable>

        {chats.length === 0 ? (
          <Text className="font-jk text-muted text-[13px] py-5">
            Nothing yet. Whatever you ask will be saved here.
          </Text>
        ) : (
          chats.map((entry) => {
            const active = entry.id === activeChatId;
            const entryUnit = unitById(units, entry.unitId);

            return (
              <View
                key={entry.id}
                className="flex-row items-center border-b border-line"
              >
                <Pressable
                  onPress={() => {
                    impact("light");
                    selectChat(entry.id);
                    setDrawerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={entry.title}
                  className="flex-1 py-3.5 pr-3 active:opacity-60"
                >
                  <Text
                    numberOfLines={1}
                    className={`text-[14.5px] ${
                      active ? "font-jk-semi text-ink" : "font-jk text-ink"
                    }`}
                  >
                    {entry.title}
                  </Text>
                  <Text className="font-jk text-muted text-[12px] mt-0.5">
                    {[entryUnit?.code, formatDateTime(entry.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    impact("light");
                    deleteChat(entry.id);
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${entry.title}`}
                  className="h-8 w-8 items-center justify-center rounded-full active:bg-surface"
                >
                  <Trash2 size={15} color={COLORS.danger} strokeWidth={1.8} />
                </Pressable>
              </View>
            );
          })
        )}
      </Sheet>

      {/* --- Scope: unit and mode, in one panel --- */}
      <Sheet
        visible={scopeOpen}
        onClose={() => setScopeOpen(false)}
        title="Focus"
        subtitle="What the tutor reads, and what it does with it."
      >
        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mb-1">
          UNIT
        </Text>
        {[null, ...units].map((option) => {
          const active = (option?.id ?? null) === unitId;

          return (
            <Pressable
              key={option?.id ?? "all"}
              onPress={() => {
                impact("light");
                const target = chat ?? newChat(option?.id ?? null);
                setChatUnit(target.id, option?.id ?? null);
                setScopeOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option ? option.code : "All units"}
              className="flex-row items-center py-3 active:opacity-60"
            >
              <View className="flex-1 pr-3">
                <Text
                  className={`text-[15px] ${
                    active ? "font-jk-semi text-ink" : "font-jk text-ink"
                  }`}
                >
                  {option ? option.code : "All units"}
                </Text>
                {option ? (
                  <Text numberOfLines={1} className="font-jk text-muted text-[12px] mt-0.5">
                    {option.title}
                  </Text>
                ) : null}
              </View>
              {active ? <Check size={17} color="#007FFA" strokeWidth={2} /> : null}
            </Pressable>
          );
        })}

        <Text className="font-jk-med text-muted text-[11px] tracking-[0.8px] mt-5 mb-1 pt-4 border-t border-line">
          MODE
        </Text>
        {MODES.map((option) => {
          const active = option.key === mode;

          return (
            <Pressable
              key={option.key}
              onPress={() => {
                impact("light");
                setMode(option.key);
                setScopeOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              className="flex-row items-center py-3 active:opacity-60"
            >
              <View className="flex-1 pr-3">
                <Text
                  className={`text-[15px] ${
                    active ? "font-jk-semi text-ink" : "font-jk text-ink"
                  }`}
                >
                  {option.label}
                </Text>
                <Text className="font-jk text-muted text-[12px] mt-0.5">
                  {option.hint}
                </Text>
              </View>
              {active ? <Check size={17} color="#007FFA" strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <LimitSheet verdict={blocked} onClose={() => setBlocked(null)} />

      <ConfirmDialog
        visible={Boolean(dictation.error)}
        title="Can't hear you"
        message={dictation.error}
        confirmLabel="OK"
        onConfirm={dictation.clearError}
        onDismiss={dictation.clearError}
      />
    </View>
  );
}

// --- Ask -------------------------------------------------------------------

function Bubble({ message }) {
  const fromStudent = message.role === "student";

  return (
    <View
      className={`max-w-[88%] ${
        fromStudent ? "self-end rounded-2xl bg-surface px-4 py-3" : "self-start"
      }`}
    >
      <Text className="font-jk text-ink text-[14.5px] leading-[21px]">
        {message.text}
      </Text>

      {/* Citations, not decoration: the student has to be able to check the
          answer against the note it came out of. */}
      {message.sources?.length ? (
        <View className="flex-row flex-wrap gap-1.5 mt-3">
          {message.sources.map((source) => (
            <View key={source} className="rounded-full bg-surface px-2.5 py-1">
              <Text className="font-jk text-muted text-[11px]">{source}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// --- Quiz ------------------------------------------------------------------

function QuizPane({ materials, unit, tier, usage, onStart, onBlocked }) {
  const [seed, setSeed] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const size = quizSize(tier);

  // Rebuilt whenever the scope or the seed changes; `seed` is what "new set"
  // increments, since the question picker shuffles.
  const questions = useMemo(
    () => buildQuiz(materials, { count: size }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materials, seed, size]
  );

  /**
   * A "set" is what the quota counts, not a question.
   *
   * Checked when a new set is asked for rather than on every reveal — a
   * student stepping through the questions they already have is still inside
   * the one quiz they were allowed.
   */
  const newSet = () => {
    const allowance = canStartQuiz(tier, usage);
    if (!allowance.ok) {
      onBlocked(allowance);
      return;
    }
    onStart();
    setSeed((value) => value + 1);
  };

  useEffect(() => {
    setIndex(0);
    setRevealed(false);
  }, [questions]);

  if (questions.length === 0) {
    return (
      <View className="flex-1 justify-center px-5">
        <EmptyState
          Icon={MessageSquare}
          title="Not enough to quiz on"
          message={`Questions are built out of full sentences in your notes. Add a longer one${
            unit ? ` under ${unit.code}` : ""
          } and a set appears here.`}
        />
      </View>
    );
  }

  const question = questions[Math.min(index, questions.length - 1)];
  const last = index >= questions.length - 1;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, rowGap: 18 }}
    >
      <Text className="font-jk text-muted text-[12px]">
        Question {index + 1} of {questions.length}
      </Text>

      <Text className="font-jk text-ink text-[19px] leading-[28px]">
        {question.prompt}
      </Text>

      <View className="border-t border-line pt-4">
        {revealed ? (
          <Text className="font-jk-semi text-primary text-[18px]">
            {question.answer}
          </Text>
        ) : (
          <Pressable
            onPress={() => {
              impact("light");
              setRevealed(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Reveal answer"
            className="flex-row items-center gap-x-2 active:opacity-60"
          >
            <Eye size={15} color="#71717A" strokeWidth={1.8} />
            <Text className="font-jk text-muted text-[13.5px]">Tap to reveal</Text>
          </Pressable>
        )}

        <Text className="font-jk text-muted text-[11.5px] mt-3">
          From “{question.source}”
        </Text>
      </View>

      <View className="flex-row gap-x-2.5">
        <Pressable
          onPress={() => {
            impact("light");
            newSet();
          }}
          accessibilityRole="button"
          accessibilityLabel="New set of questions"
          className="rounded-full border border-line px-4 py-3 active:bg-surface"
        >
          <Text className="font-jk-med text-muted text-[13.5px]">New set</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            impact("medium");
            if (last) {
              notify("success");
              newSet();
              return;
            }
            setIndex((value) => value + 1);
            setRevealed(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={last ? "Finish and start a new set" : "Next question"}
          className="flex-1 items-center justify-center rounded-full bg-primary py-3 active:opacity-85"
        >
          <Text className="font-jk-med text-canvas text-[13.5px]">
            {last ? "Finish" : "Next"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// --- Cards -----------------------------------------------------------------

function CardsPane({ materials, units, unit }) {
  const cards = useMemo(() => buildFlashcards(materials), [materials]);
  const [flipped, setFlipped] = useState(() => new Set());

  if (cards.length === 0) {
    return (
      <View className="flex-1 justify-center px-5">
        <EmptyState
          Icon={RotateCcw}
          title="No cards yet"
          message={`Each note becomes a card: its title in front, its opening lines behind. File one${
            unit ? ` under ${unit.code}` : ""
          } to start.`}
        />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
    >
      <Text className="font-jk text-muted text-[12px] pb-1">
        {cards.length} {cards.length === 1 ? "card" : "cards"} · tap to flip
      </Text>

      {cards.map((card, index) => {
        const open = flipped.has(card.id);
        const cardUnit = unitById(units, card.unitId);

        return (
          <Pressable
            key={card.id}
            onPress={() => {
              impact("light");
              setFlipped((current) => {
                const next = new Set(current);
                if (next.has(card.id)) next.delete(card.id);
                else next.add(card.id);
                return next;
              });
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={card.front}
            className={`py-4 active:opacity-60 ${
              index === cards.length - 1 ? "" : "border-b border-line"
            }`}
          >
            <Text className="font-jk text-muted text-[11.5px]">
              {cardUnit?.code ?? "—"}
            </Text>
            <Text className="font-jk-med text-ink text-[15px] leading-[21px] mt-1">
              {card.front}
            </Text>

            {open ? (
              <Text className="font-jk text-muted text-[13px] leading-[19px] mt-2">
                {card.back}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
