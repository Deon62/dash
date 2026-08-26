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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];
    return { kind: "image", title: asset.fileName ?? "Photo", uri: asset.uri, body: "" };
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

    return { kind: "pdf", title: asset.name ?? "Document", uri: asset.uri, body: "" };
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
            placeholder={format === "link" ? "What is this?" : "Week 4 — Hashing"}
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
