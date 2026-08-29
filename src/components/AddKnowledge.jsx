import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { FileText, Link2, NotebookPen, ScanText } from "lucide-react-native";

import Sheet from "@/components/Sheet";
import Button from "@/components/Button";
import Disc from "@/components/Disc";
import { canAttachFile } from "@/lib/quota";
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
    hint: "Pick a photo of a page from your library",
    Icon: ScanText,
  },
  {
    key: "link",
    label: "Link",
    hint: "An article or a video",
    Icon: Link2,
  },
];

function Option({ Icon, label, hint, onPress }) {
  return (
    <Pressable
      onPress={() => {
        impact("light");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center py-3.5 active:opacity-60"
    >
      <Disc size={40}>
        <Icon size={17} color={COLORS.ink} strokeWidth={1.8} />
      </Disc>
      <View className="flex-1 ml-3.5">
        <Text className="font-jk-med text-ink text-[15px]">{label}</Text>
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

  const pickImage = async () => {
    // Straight to the system photo picker, with nothing asked for first. See
    // the note in `AvatarPicker.jsx`: the permission request this used to make
    // could only ever fail, and a silent `return null` made it look like the
    // picker had been cancelled.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];

    // `mimeType`, `filename` and `size` are what the upload asks the server to
    // sign for. Without them the request is refused on type or measured
    // wrongly on size, which is a plan limit enforced against a guess.
    return {
      kind: "image",
      title: asset.fileName ?? "Photo",
      filename: asset.fileName ?? "photo.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize ?? 0,
      uri: asset.uri,
      body: "",
    };
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

    // Dismiss before handing over to the system picker: presenting one on top
    // of an open modal is unreliable on iOS, where it can come up behind the
    // sheet or not at all. The component stays mounted, so `unitId` survives.
    onClose();
    await new Promise((resolve) => setTimeout(resolve, 320));

    const payload = key === "image" ? await pickImage() : await pickPdf();

    if (payload) {
      onSave({ unitId, ...payload });
      notify("success");
    }

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
            hint={option.hint}
            onPress={() => chooseFormat(option.key)}
          />
        ))
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
