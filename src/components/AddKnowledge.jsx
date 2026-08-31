import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Camera, FileText, Images, Link2, Lock, NotebookPen, ScanText } from "lucide-react-native";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import Disc from "@/components/Disc";
import { canAttachFile, canUseOcr, scanningIncluded } from "@/lib/quota";
import { captureScan, pickScan } from "@/lib/scan";
import { COLORS } from "@/theme/colors";
import TextField from "@/components/TextField";
import { NOTE_WORD_LIMIT, countWords } from "@/lib/notes";
import { impact, notify } from "@/lib/haptics";

const FORMATS = [
  {
    key: "note",
    label: "Note",
    hint: "Type or paste text",
    Icon: NotebookPen,
  },
  {
    key: "pdf",
    label: "PDF",
    hint: "Slides, papers, past exams",
    Icon: FileText,
  },
  {
    key: "image",
    label: "Handwritten notes",
    hint: "Photograph a page and the tutor can read it",
    Icon: ScanText,
  },
  {
    key: "link",
    label: "Link",
    hint: "An article or a video",
    Icon: Link2,
  },
];

function Option({ Icon, label, hint, onPress, locked = false }) {
  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      className="flex-row items-center py-3.5 active:opacity-60"
    >
      <Disc size={40}>
        <Icon size={17} color={locked ? COLORS.faint : COLORS.ink} strokeWidth={1.8} />
      </Disc>
      <View className="flex-1 ml-3.5">
        <View className="flex-row items-center gap-x-1.5">
          <Text
            className={`font-jk-med text-[15px] ${locked ? "text-muted" : "text-ink"}`}
          >
            {label}
          </Text>
          {/* Shown rather than hidden. A feature that simply is not on the
              list is a feature nobody knows they could have — and this one is
              already named on the pricing card, so removing it here would make
              the card advertise something the app appears not to do. It is
              still pressable, and says why on the other side. */}
          {locked ? <Lock size={11} color={COLORS.faint} strokeWidth={2} /> : null}
        </View>
        <Text className="font-jk text-muted text-[12px] mt-0.5">{hint}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Adding knowledge, in the order a student thinks about it.
 *
 * Unit first, then format. It reads backwards to a developer — the file type is
 * what the code branches on — but a student never opens this thinking "I have
 * a PDF"; they think "this is for CS201". Asking for the unit first also means
 * the answer is never guessed from whatever tab was open.
 */
export default function AddKnowledge({
  visible,
  onClose,
  units,
  onSave,
  lockedUnitId,
  tier,
  onBlocked,
  /**
   * `serverUsage.ocrPages` where it has landed, or null.
   *
   * Passed in rather than read from the store here, because this sheet is
   * rendered by two screens that already hold it — and a component that
   * reaches into global state for one field is the one that cannot be tested
   * or reused.
   */
  ocrMeter = null,
  /** The device's own counters, for the first render and for no connection. */
  usage,
}) {
  const [step, setStep] = useState(lockedUnitId ? "format" : "unit");
  const [unitId, setUnitId] = useState(lockedUnitId ?? null);
  const [format, setFormat] = useState(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const reset = () => {
    setStep(lockedUnitId ? "format" : "unit");
    setUnitId(lockedUnitId ?? null);
    setFormat(null);
    setTitle("");
    setBody("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const file = (payload) => {
    onSave({ unitId, ...payload });
    notify("success");
    close();
  };

  /**
   * Whether a page may be scanned right now — asked before the camera opens.
   *
   * The server refuses an over-allowance scan by marking the material
   * `skipped`, which is correct and is a miserable way to be told: by then the
   * page has been framed, photographed and uploaded. Two different refusals
   * come back from this, and they need different ways out — the sheet the
   * verdict opens knows which, because the verdict says.
   */
  const scanAllowance = canUseOcr(tier, usage, ocrMeter);
  const scanIncluded = scanningIncluded(tier, ocrMeter);

  /**
   * Scans left this month, or null where there is no figure worth printing.
   *
   * Only from the server's meter. The device's tally is the right fallback for
   * *refusing* — it is conservative and works offline — but it is the wrong
   * thing to print as a count, because it knows nothing about a page scanned on
   * another handset. A number that is quietly wrong is worse than no number on
   * the screen somebody is about to spend one from.
   */
  const left =
    ocrMeter && !ocrMeter.unlimited
      ? Math.max(0, ocrMeter.limit - ocrMeter.used)
      : null;

  const runScan = async (take) => {
    const { payload, error } = take ? await captureScan() : await pickScan();

    // A cancel is not a failure. Nothing is said and nothing is filed.
    if (!payload) {
      if (error) onBlocked?.({ ok: false, reason: "scan", detail: error, upgradable: false });
      return;
    }

    onSave({ unitId, ...payload });
    notify("success");
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      // Copied into the app's own storage, otherwise the URI stops resolving
      // as soon as the system clears its share cache.
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];

    // Size is the one file limit that can be checked here — the picker reports
    // it. Page count cannot be, because nothing in the app reads a PDF yet.
    const allowance = canAttachFile(tier, asset.size);
    if (!allowance.ok) {
      onBlocked?.(allowance);
      return null;
    }

    return {
      kind: "pdf",
      title: asset.name ?? "Document",
      filename: asset.name ?? "document.pdf",
      mimeType: asset.mimeType ?? "application/pdf",
      size: asset.size ?? 0,
      uri: asset.uri,
      body: "",
    };
  };

  const chooseFormat = async (key) => {
    setFormat(key);

    if (key === "note" || key === "link") {
      setStep("capture");
      return;
    }

    /**
     * A scan gets its own step before the camera, and it earns it.
     *
     * The refusal happens here, where it costs nothing, rather than after an
     * upload. And the framing guidance measurably changes the outcome — "no
     * text found" is overwhelmingly a page shot at an angle or half out of
     * frame, and that is the one thing a student can fix before they press the
     * shutter rather than after the server has told them off.
     */
    if (key === "image") {
      if (!scanAllowance.ok) {
        onClose();
        onBlocked?.(scanAllowance);
        reset();
        return;
      }

      setStep("scan");
      return;
    }

    // Dismiss before handing over to the system picker: presenting one on top
    // of an open modal is unreliable on iOS, where it can come up behind the
    // sheet or not at all. The component stays mounted, so `unitId` survives.
    onClose();
    await new Promise((resolve) => setTimeout(resolve, 320));

    const payload = await pickPdf();

    if (payload) {
      onSave({ unitId, ...payload });
      notify("success");
    }

    reset();
  };

  /** Hands over to the camera or the library, with the sheet out of the way. */
  const leaveFor = async (take) => {
    onClose();
    await new Promise((resolve) => setTimeout(resolve, 320));
    await runScan(take);
    reset();
  };

  const unit = units.find((option) => option.id === unitId);

  /**
   * Where a note stops being a card, said while it is being written.
   *
   * Not a cap. Nothing here refuses a long note or shortens one — it is filed
   * whole and the tutor reads all of it, which is the point of typing it out.
   * What changes past the line is only that it stops appearing in the deck,
   * because a card that cannot show its note whole is worse than no card. That
   * is a thing worth knowing before you press the button rather than after,
   * when the deck is short and there is nothing to explain why.
   *
   * Counted only for notes: a link has no body to speak of, and a PDF was
   * never going to be a card.
   */
  const writingNote = format === "note";
  const words = writingNote ? countWords(body) : 0;
  const pastCardLength = words > NOTE_WORD_LIMIT;

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={
        step === "unit"
          ? "Which unit is this for?"
          : step === "format"
            ? "What are you adding?"
            : step === "scan"
              ? "Photograph one page"
              : format === "link"
                ? "Add a link"
                : "Write a note"
      }
      subtitle={step !== "unit" && unit ? `${unit.code} · ${unit.title}` : undefined}
    >
      {step === "unit" ? (
        units.length === 0 ? (
          <Text className="font-jk text-muted text-[13.5px] leading-[20px] py-2">
            You have no units yet. Add one first and everything else can be filed
            underneath it.
          </Text>
        ) : (
          units.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                impact("light");
                setUnitId(option.id);
                setStep("format");
              }}
              accessibilityRole="button"
              accessibilityLabel={`${option.code} ${option.title}`}
              className="flex-row items-center py-3.5 border-b border-line active:opacity-60"
            >
              <View className="flex-1">
                <Text className="font-jk-semi text-ink text-[15px]">
                  {option.code}
                </Text>
                <Text
                  numberOfLines={1}
                  className="font-jk text-muted text-[12.5px] mt-0.5"
                >
                  {option.title}
                </Text>
              </View>
            </Pressable>
          ))
        )
      ) : step === "format" ? (
        FORMATS.map((option) => (
          <Option
            key={option.key}
            Icon={option.Icon}
            label={option.label}
            hint={
              option.key === "image" && !scanIncluded
                ? "On Synapse — the tutor reads your handwriting"
                : option.hint
            }
            locked={option.key === "image" && !scanAllowance.ok}
            onPress={() => chooseFormat(option.key)}
          />
        ))
      ) : step === "scan" ? (
        <View className="gap-y-3">
          {/* Guidance before the shutter, not advice after the refusal. Nearly
              every "we could not find any text" is a page shot at an angle or
              half out of frame, and that is the only part of this a student
              can do anything about — once the photo is taken the server's
              options are to read it or reject it. */}
          <View className="rounded-2xl bg-surface px-4 py-3.5">
            <Text className="font-jk text-ink text-[13px] leading-[19px]">
              Fill the frame with the page, hold the phone square to it, and keep
              the writing in focus. One photo is one page.
            </Text>
          </View>

          {left !== null ? (
            <Text className="font-jk text-muted text-[12px] -mt-1">
              {left} {left === 1 ? "scan" : "scans"} left this month.
            </Text>
          ) : null}

          <Option
            Icon={Camera}
            label="Take a photo"
            hint="Opens the camera"
            onPress={() => leaveFor(true)}
          />
          <Option
            Icon={Images}
            label="Choose an existing photo"
            hint="One you have already taken"
            onPress={() => leaveFor(false)}
          />
        </View>
      ) : (
        <View className="gap-y-4">
          <TextField
            label="TITLE"
            value={title}
            onChangeText={setTitle}
            placeholder={format === "link" ? "What is this?" : "Week 4: Hashing"}
            autoFocus
          />

          <TextField
            label={format === "link" ? "URL" : "CONTENT"}
            value={body}
            onChangeText={setBody}
            placeholder={
              format === "link"
                ? "https://…"
                : "Paste or type it here. Text is what the tutor can actually read back to you."
            }
            multiline={format !== "link"}
            autoCapitalize={format === "link" ? "none" : "sentences"}
            autoCorrect={format !== "link"}
            keyboardType={format === "link" ? "url" : "default"}
          />

          {/* Under the field the whole time rather than appearing at the end.
              Somebody pasting three pages should find out what happens to it
              at the moment they paste, not by noticing later that it never
              turned up in the deck.

              Muted in both states, and never red: going long is a decision,
              not a mistake, and colouring it as a failure would push people
              into cutting notes that were the right length for what they
              were. */}
          {writingNote ? (
            <View className="flex-row items-baseline justify-between -mt-2">
              <Text className="font-jk text-muted text-[11.5px] leading-[16px] flex-1 pr-3">
                {pastCardLength
                  ? "Long enough that it won't become a flashcard — it stays filed, and the tutor still reads all of it."
                  : `Under ${NOTE_WORD_LIMIT} words also becomes a flashcard, shown whole.`}
              </Text>

              <Text className="font-jk-med text-faint text-[11.5px]">
                {words}/{NOTE_WORD_LIMIT}
              </Text>
            </View>
          ) : null}

          <Button
            label="File it"
            disabled={title.trim().length < 2}
            onPress={() => file({ kind: format, title, body })}
          />
        </View>
      )}
    </Sheet>
  );
}
