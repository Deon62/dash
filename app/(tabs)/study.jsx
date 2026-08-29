import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  unstable_batchedUpdates,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check,
  ChevronDown,
  Copy,
  MessageSquare,
  PanelLeft,
  RotateCcw,
  SquarePen,
  Trash2,
} from "lucide-react-native";

import Sheet from "@/components/Sheet";
import LimitSheet from "@/components/LimitSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import Notice, { toneForError } from "@/components/Notice";
import IconButton from "@/components/IconButton";
import Disc from "@/components/Disc";
import EmptyState from "@/components/EmptyState";
import ThinkingLabel from "@/components/ThinkingLabel";
import { useStudyStore, unitById } from "@/store/useStudyStore";
import { askTutor, buildFlashcards, buildQuiz, countCards } from "@/lib/tutor";
import { NOTE_WORD_LIMIT } from "@/lib/notes";
import { newId } from "@/lib/ids";
import { recordStudyDay } from "@/lib/account";
import { formatDateTime, greeting } from "@/lib/dates";
import { getTabBarHeight } from "@/theme/layout";
import { useKeyboard } from "@/lib/useKeyboardVisible";
import { activeTier, canAskAi, canStartQuiz, quizSize } from "@/lib/quota";
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
  /** Anything that went wrong that is not a limit. Shown, then dismissed. */
  const [failure, setFailure] = useState(null);
  /**
   * The answer as it arrives.
   *
   * Held here rather than written into the chat token by token: the store is
   * persisted, and putting a stream through it would write the conversation to
   * disk on every few characters. The finished answer is appended once.
   */
  const [streaming, setStreaming] = useState(null);

  const scrollRef = useRef(null);

  /**
   * The stream, between frames.
   *
   * Tokens arrive far faster than the screen refreshes — a dozen or more
   * between two frames — and setting state on each one made React re-render
   * the whole thread that many times for one frame of visible change. That is
   * where the flicker came from: layout ran mid-paint, the scroll below was
   * restarted before it had finished, and the text stepped rather than grew.
   *
   * So the text lands here, and one `requestAnimationFrame` per frame is what
   * puts it on screen. Nothing is dropped — `whole` is cumulative, so the
   * frame that renders carries every token that arrived before it.
   */
  const pending = useRef(null);
  const frame = useRef(0);

  /** True while a stream is running, read by the scroll handler below. */
  const live = useRef(false);

  const flushStream = useCallback(() => {
    frame.current = 0;
    const next = pending.current;
    if (next) setStreaming(next);
  }, []);

  const pushStream = useCallback(
    (patch) => {
      pending.current = { ...(pending.current ?? { text: "", sources: [] }), ...patch };
      if (frame.current) return;
      frame.current = requestAnimationFrame(flushStream);
    },
    [flushStream],
  );

  // A stream left running when the screen goes is a callback into a component
  // that is not there any more.
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * Follows the answer down as it is written.
   *
   * `animated: false` while streaming, and that is the point rather than a
   * shortcut: content grows every frame, each growth fires this, and an
   * animated scroll that is restarted before it can finish never arrives —
   * it just judders in place. Unanimated, the view is simply already at the
   * bottom on every frame, which is what following along looks like.
   */
  const stickToBottom = useCallback(() => {
    if (messagesRef.current === 0) return;
    scrollRef.current?.scrollToEnd({ animated: !live.current });
  }, []);

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

  // Read from `stickToBottom`, which must not be rebuilt every render — a new
  // `onContentSizeChange` identity on each token is another thing for the
  // ScrollView to reconcile mid-stream.
  const messagesRef = useRef(0);
  messagesRef.current = messages.length;

  // What the current plan allows, read before `ask` is defined because `ask`
  // closes over it. The server meters the same allowance and is what actually
  // refuses; this is so a student out of questions is told before the request.
  const tier = activeTier(subscription);

  /**
   * Asks the tutor, and renders the answer as it comes.
   *
   * Retrieval happens on the server, over everything filed — including the
   * text pulled out of PDFs, which this device never sees. The answer arrives
   * as a stream, so the first words appear in about a second rather than the
   * whole thing landing after six.
   */
  const ask = async (question) => {
    const text = question.trim();
    if (!text || thinking) return;

    // Checked before the question is posted, not after: showing a student's
    // own words in the thread and then refusing to answer them reads as a
    // failure rather than as a limit.
    const allowance = canAskAi(tier, usage);
    if (!allowance.ok) {
      setBlocked(allowance);
      return;
    }

    impact("medium");
    const target = chat ?? newChat(unitId);

    // Both ids are minted here, before either row exists anywhere, and the
    // same pair goes to the server. Otherwise each side stores the turn under
    // ids the other has never seen and the next sync pulls the server's copies
    // down as extra messages — every answer appearing twice.
    const studentMessageId = newId();
    const answerMessageId = newId();

    appendMessage(target.id, { id: studentMessageId, role: "student", text });
    setDraft("");
    setThinking(true);
    live.current = true;
    pending.current = { text: "", sources: [] };
    setStreaming({ text: "", sources: [] });

    // The device's own counters, so a limit can still be refused with no
    // connection. The server keeps the numbers that decide.
    recordAiQuery();
    recordStudyDay();

    const result = await askTutor({
      question: text,
      chatId: target.id,
      unitCode: unit?.code ?? null,
      // Both go through `pushStream`, which coalesces to one render a frame.
      // `whole` is the answer so far, not the new piece, so a frame that
      // renders is never behind the tokens that arrived during it.
      onMeta: (meta) => pushStream({ sources: meta.sources ?? [] }),
      onToken: (_piece, whole) => pushStream({ text: whole }),
      studentMessageId,
      answerMessageId,
    });

    // Anything still queued belongs to an answer that is about to be replaced
    // by the finished one. Letting it land would paint a stale frame over it.
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    pending.current = null;
    live.current = false;

    if (result.error && !result.text) {
      setStreaming(null);
      setThinking(false);

      // 402 is a plan limit — not included in what you pay for — and belongs in
      // the sheet that explains limits and offers a way out. Everything else is
      // a failure, and telling someone with no signal to upgrade their plan is
      // the wrong answer to the wrong question.
      if (result.status === 402) setBlocked({ reason: "ai", detail: result.error });
      else setFailure(result.error);
      return;
    }

    /**
     * The handover, in one paint.
     *
     * The streamed bubble and the stored one are the same answer coming from
     * two different places — React state and the store — and clearing one
     * before writing the other leaves a frame showing either both or neither.
     * Both read as a blink at the end of every answer. Batched, the swap
     * happens between frames and there is nothing to see.
     */
    unstable_batchedUpdates(() => {
      appendMessage(target.id, {
        id: answerMessageId,
        role: "tutor",
        text: result.error ? `${result.text}\n\n${result.error}` : result.text,
        sources: (result.sources ?? []).map((source) =>
          source.page_number
            ? `${source.title} · p.${source.page_number}`
            : source.title,
        ),
      });

      setStreaming(null);
      setThinking(false);
    });
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
          onContentSizeChange={stickToBottom}
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

          {/* The answer while it is still arriving. Rendered as an ordinary
              bubble so nothing shifts when the finished one replaces it —
              minus the copy button, which would offer half an answer. */}
          {streaming?.text ? (
            <Bubble
              streaming
              message={{
                role: "tutor",
                text: streaming.text,
                sources: (streaming.sources ?? []).map((source) => source.title),
              }}
            />
          ) : thinking ? (
            <View className="self-start px-1 py-2">
              <ThinkingLabel />
            </View>
          ) : null}
        </ScrollView>
      ) : mode === "quiz" ? (
        <QuizPane
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
        visible={Boolean(failure)}
        title="We couldn't answer that one"
        // Their question is still in the thread above, so "ask again" means
        // tapping send on what is already typed rather than retyping it.
        message={`${failure} Your question is still here. Try sending it again in a moment.`}
        confirmLabel="OK"
        onConfirm={() => setFailure(null)}
        onDismiss={() => setFailure(null)}
      />

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

/**
 * Tidies an answer on its way to the clipboard.
 *
 * What the model writes is already formatted — headings, lists, the odd code
 * fence — and that formatting is the reason anyone copies it, so none of it is
 * touched. This only removes what the stream leaves behind: trailing spaces on
 * a line that was written in pieces, and the runs of blank lines that come of
 * a paragraph break arriving in two frames. Pasted into notes, the difference
 * is between text that looks typed and text that looks scraped.
 */
function forClipboard(text) {
  return String(text ?? "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * One turn.
 *
 * `memo` is not a micro-optimisation here. A streamed answer re-renders this
 * screen many times a second, and without it every bubble in the thread —
 * every paragraph of every previous answer — is laid out again on each of
 * those renders. That was most of the flicker: the work per frame grew with
 * the length of the conversation, so the longer a student had been talking,
 * the worse the stream looked. A settled message never changes, so it never
 * needs to be measured twice.
 */
const Bubble = memo(function Bubble({ message, streaming = false }) {
  const fromStudent = message.role === "student";

  const [copied, setCopied] = useState(false);

  // The label reverts on its own: a "Copied" that never leaves has stopped
  // saying anything by the second tap.
  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    impact("light");
    await Clipboard.setStringAsync(forClipboard(message.text));
    setCopied(true);
  };

  return (
    <View
      className={`max-w-[88%] ${
        fromStudent ? "self-end rounded-2xl bg-surface px-4 py-3" : "self-start"
      }`}
    >
      <Text
        className="font-jk text-ink text-[14.5px] leading-[21px]"
        // The answer is the one thing on this screen worth taking away, and a
        // student quoting it in an essay needs a part rather than the whole.
        selectable={!fromStudent}
      >
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

      {/* Under the answer and quiet with it. Not on the student's own words —
          they have those already — and not while the answer is still being
          written, where it would copy half a sentence. */}
      {!fromStudent && !streaming && message.text ? (
        <Pressable
          onPress={copy}
          accessibilityRole="button"
          accessibilityLabel={copied ? "Answer copied" : "Copy answer"}
          hitSlop={10}
          className="flex-row items-center gap-1.5 mt-2.5 -ml-0.5 self-start active:opacity-60"
        >
          {copied ? (
            <Check size={13} color={COLORS.primary} strokeWidth={2.5} />
          ) : (
            <Copy size={13} color={COLORS.faint} strokeWidth={2} />
          )}
          <Text
            className={`font-jk-med text-[11.5px] ${
              copied ? "text-primary" : "text-faint"
            }`}
          >
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

// --- Quiz ------------------------------------------------------------------

/**
 * A quiz, built by the server from the student's own material.
 *
 * Multiple choice rather than the fill-in-the-blank the device used to cut out
 * of a sentence: a blanked word can only test recall of the exact phrasing a
 * note happened to use, and it marks a right answer wrong for being worded
 * differently. Four options with an explanation is a question a person can
 * actually learn from being wrong about.
 */
function QuizPane({ unit, tier, usage, onStart, onBlocked }) {
  const [questions, setQuestions] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);

  const size = quizSize(tier);

  /**
   * A "set" is what the quota counts, not a question.
   *
   * Stepping through questions already built is still inside the one quiz the
   * student was allowed; only asking for a new set spends another.
   */
  const newSet = async () => {
    const allowance = canStartQuiz(tier, usage);
    if (!allowance.ok) {
      onBlocked(allowance);
      return;
    }

    setLoading(true);
    setError("");

    const result = await buildQuiz({ unitCode: unit?.code ?? null, count: size });

    setLoading(false);

    if (result.error) {
      // A plan limit goes to the sheet that explains limits; anything else is
      // said in place, where the student is already looking.
      if (result.status === 402) onBlocked({ reason: "quiz", detail: result.error });
      else setError(result.error);
      return;
    }

    if (result.questions.length === 0) {
      setError(
        `There is not enough filed${unit ? ` under ${unit.code}` : ""} to build a quiz yet. Add a note or a set of slides in Knowledge and try again.`,
      );
      return;
    }

    onStart();
    setQuestions(result.questions);
    setNote(result.note);
    setIndex(0);
    setPicked(null);
  };

  // Nothing is fetched on mount: a quiz costs a request and counts against a
  // weekly allowance, so it starts when the student asks for one.
  if (questions.length === 0) {
    // A failed first attempt gets the card rather than being folded into the
    // empty state's own copy. "Ready when you are" sitting above the reason it
    // was not ready reads as the app not having noticed.
    if (error && !loading) {
      return (
        <View className="flex-1 justify-center px-5">
          <Notice
            tone={toneForError(error)}
            message={error}
            actionLabel="Try again"
            onAction={newSet}
          />
        </View>
      );
    }

    return (
      <View className="flex-1 justify-center px-5">
        {/* The heading stays literal while a set is being written — this is a
            wait a student can be blocked on, so the rotating word goes
            underneath it rather than in place of it. The invitation to start
            has to go too: it is wrong once a set is already on its way. */}
        <EmptyState
          Icon={MessageSquare}
          title={loading ? "Building your quiz…" : "Ready when you are"}
          message={
            loading
              ? `Reading what you have filed${unit ? ` under ${unit.code}` : ""} and writing questions from it.`
              : `Questions are written from what you have filed${unit ? ` under ${unit.code}` : ""}. Start a set and they appear here.`
          }
          action={
            loading ? (
              <ThinkingLabel />
            ) : (
              <Pressable
                onPress={() => {
                  impact("medium");
                  newSet();
                }}
                accessibilityRole="button"
                accessibilityLabel="Start a quiz"
                className="rounded-full bg-primary px-5 py-3 active:opacity-85"
              >
                <Text className="font-jk-med text-canvas text-[13.5px]">
                  Start a quiz
                </Text>
              </Pressable>
            )
          }
        />
      </View>
    );
  }

  const question = questions[Math.min(index, questions.length - 1)];
  const last = index >= questions.length - 1;
  const answered = picked !== null;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, rowGap: 18 }}
    >
      <Text className="font-jk text-muted text-[12px]">
        Question {index + 1} of {questions.length}
        {note ? ` · ${note}` : ""}
      </Text>

      <Text className="font-jk text-ink text-[19px] leading-[28px]">
        {question.prompt}
      </Text>

      <View className="gap-y-2.5">
        {question.options.map((option, optionIndex) => {
          const correct = optionIndex === question.answer;
          const chosen = optionIndex === picked;

          // Colour only after an answer: highlighting before would give the
          // question away, and greying options out reads as "not allowed"
          // rather than "not chosen".
          const tone = !answered
            ? { borderColor: COLORS.line, backgroundColor: COLORS.canvas }
            : correct
              ? { borderColor: COLORS.primary, backgroundColor: COLORS.surface }
              : chosen
                ? { borderColor: COLORS.danger, backgroundColor: COLORS.canvas }
                : { borderColor: COLORS.line, backgroundColor: COLORS.canvas };

          return (
            <Pressable
              key={option}
              onPress={() => {
                if (answered) return;
                impact("light");
                if (optionIndex === question.answer) notify("success");
                setPicked(optionIndex);
              }}
              accessibilityRole="button"
              accessibilityLabel={option}
              accessibilityState={{ selected: chosen, disabled: answered }}
              style={{ ...tone, borderWidth: 1, borderRadius: 16, padding: 14 }}
              className="active:opacity-70"
            >
              <Text className="font-jk text-ink text-[14.5px] leading-[21px]">
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View className="border-t border-line pt-4">
          <Text className="font-jk-med text-ink text-[14px]">
            {picked === question.answer ? "Right." : "Not quite."}
          </Text>
          {question.explanation ? (
            <Text className="font-jk text-muted text-[13.5px] leading-[20px] mt-1.5">
              {question.explanation}
            </Text>
          ) : null}
          {question.source ? (
            <Text className="font-jk text-muted text-[11.5px] mt-3">
              From “{question.source}”
            </Text>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Notice
          tone={toneForError(error)}
          message={error}
          actionLabel={loading ? undefined : "Try again"}
          onAction={newSet}
          onDismiss={() => setError("")}
        />
      ) : null}

      <View className="flex-row gap-x-2.5">
        <Pressable
          onPress={() => {
            impact("light");
            newSet();
          }}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="New set of questions"
          className="rounded-full border border-line px-4 py-3 active:bg-surface"
        >
          <Text className="font-jk-med text-muted text-[13.5px]">
            {loading ? "Building…" : "New set"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            impact("medium");
            if (last) {
              newSet();
              return;
            }
            setIndex((value) => value + 1);
            setPicked(null);
          }}
          disabled={!answered || loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: !answered }}
          accessibilityLabel={last ? "Finish and start a new set" : "Next question"}
          className={`flex-1 items-center justify-center rounded-full py-3 ${
            answered ? "bg-primary active:opacity-85" : "bg-surface"
          }`}
        >
          <Text
            className={`font-jk-med text-[13.5px] ${
              answered ? "text-canvas" : "text-muted"
            }`}
          >
            {last ? "Finish" : "Next"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// --- Cards -----------------------------------------------------------------

/**
 * The colours a card can wear, one per unit.
 *
 * Not the calendar's `MARK_COLORS`: those already mean something specific
 * (violet is an assignment, red is an exam) and reusing them here would have a
 * card looking like a deadline. `flame` and `danger` are left out on purpose —
 * one belongs to the streak, the other means something has gone wrong.
 */
const CARD_TINTS = [
  COLORS.primary,
  COLORS.violet,
  COLORS.teal,
  COLORS.pink,
  COLORS.amber,
];

/**
 * The same unit gets the same colour every time.
 *
 * Hashed from the code rather than assigned by position, so a card keeps its
 * colour when another unit is added above it — colour that reshuffles is worse
 * than no colour, because the eye has already started using it to group.
 */
function cardTint(code) {
  if (!code) return COLORS.muted;

  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i)) % 100000;
  }
  return CARD_TINTS[hash % CARD_TINTS.length];
}

/** `#RRGGBB` plus an alpha byte. Used for the wash behind a flipped card. */
const wash = (hex, alpha) => `${hex}${alpha}`;

function Flashcard({ card, unitCode, open, onPress }) {
  const tint = cardTint(unitCode);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={card.front}
      accessibilityHint={open ? "Tap to hide the answer" : "Tap to reveal the answer"}
      style={{
        borderRadius: 18,
        borderWidth: 1,
        // Flipping is the whole interaction, so it changes the card itself
        // rather than only adding text underneath: the border takes the unit's
        // colour and a wash of it fills the card. From across the screen you
        // can see which ones you have already turned over.
        borderColor: open ? wash(tint, "55") : COLORS.line,
        backgroundColor: open ? wash(tint, "0D") : COLORS.canvas,
        padding: 16,
        marginBottom: 12,
      }}
      className="active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <View
          style={{ backgroundColor: wash(tint, "1A") }}
          className="rounded-full px-2.5 py-1"
        >
          <Text style={{ color: tint }} className="font-jk-semi text-[10.5px] tracking-[0.5px]">
            {unitCode ?? "UNFILED"}
          </Text>
        </View>

        <RotateCcw size={14} color={open ? tint : COLORS.faint} strokeWidth={2} />
      </View>

      <Text className="font-jk-med text-ink text-[16px] leading-[23px] mt-3">
        {card.front}
      </Text>

      {open ? (
        <>
          <View
            style={{ backgroundColor: wash(tint, "33") }}
            className="h-px my-3"
          />
          <Text className="font-jk text-ink text-[13.5px] leading-[20px]">
            {card.back}
          </Text>
        </>
      ) : null}

      {/* Said in words, every time. The old row gave the whole list one "tap
          to flip" at the top, which is read once and gone by the third card. */}
      <Text
        style={{ color: open ? tint : COLORS.faint }}
        className="font-jk text-[11px] mt-3"
      >
        {open ? "Tap to hide" : "Tap to flip"}
      </Text>
    </Pressable>
  );
}

function CardsPane({ materials, units, unit }) {
  const cards = useMemo(() => buildFlashcards(materials), [materials]);

  // Not `materials.length - cards.length`: a PDF has no text on this device
  // and was never a candidate, so counting it as something held back would be
  // explaining an absence that has nothing to do with length.
  const { tooLong } = useMemo(() => countCards(materials), [materials]);

  const [flipped, setFlipped] = useState(() => new Set());

  if (cards.length === 0) {
    return (
      <View className="flex-1 justify-center px-5">
        <EmptyState
          Icon={RotateCcw}
          title={tooLong > 0 ? "Nothing short enough yet" : "No cards yet"}
          /* Two different things to say. Told "no cards yet" while holding a
             dozen filed notes, a student reasonably concludes the app has lost
             them — so where there is long material, the message is about
             length rather than about filing. */
          message={
            tooLong > 0
              ? `A card shows a note whole, so only ones under ${NOTE_WORD_LIMIT} words become one. Your longer ${
                  tooLong === 1 ? "note is" : "notes are"
                } still filed, and the tutor reads ${
                  tooLong === 1 ? "it" : "them"
                } in full — ask about ${tooLong === 1 ? "it" : "them"} in Ask.`
              : `A note under ${NOTE_WORD_LIMIT} words becomes a card: its title in front, the note behind. File one${
                  unit ? ` under ${unit.code}` : ""
                } to start.`
          }
        />
      </View>
    );
  }

  const flip = (id) => {
    impact("light");
    setFlipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
    >
      {/* The count, and — when some were left out — why the deck is shorter
          than the library. Said once at the top rather than as a placeholder
          card per note, which would fill the deck with things you cannot
          revise from. */}
      <Text className="font-jk text-muted text-[12px] pb-2.5">
        {cards.length} {cards.length === 1 ? "card" : "cards"}
        {tooLong > 0
          ? ` · ${tooLong} ${tooLong === 1 ? "note" : "notes"} too long for one, still filed`
          : ""}
      </Text>

      {cards.map((card) => (
        <Flashcard
          key={card.id}
          card={card}
          unitCode={unitById(units, card.unitId)?.code}
          open={flipped.has(card.id)}
          onPress={() => flip(card.id)}
        />
      ))}
    </ScrollView>
  );
}
