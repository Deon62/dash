import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CircleAlert, CloudUpload } from "lucide-react-native";

import { uploadMaterial } from "@/lib/materials";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * Where an attached file has got to, on the item it belongs to.
 *
 * This replaces a sentence of grey 12px prose under the note. The problem with
 * that line was not its wording, it was that a failure looked exactly like
 * every other caption on the page — the one state a student has to notice was
 * the least noticeable thing in the list.
 *
 * So the failure gets a shape: a coloured glyph, three words, and the way out
 * beside them. Everything else stays quiet, because a file that is uploading
 * or waiting to be read needs nothing from anybody. Silence once it is ready —
 * a "done" marker on every item is a list of ticks nobody reads.
 *
 * Deliberately one line and no card. It sits inside a row that already has a
 * title and a date, and a panel around it would make an ordinary state look
 * like an incident.
 */
export default function UploadStatus({ material }) {
  const [retrying, setRetrying] = useState(false);

  const status = material.uploadStatus;

  // Nothing to say: a typed note, or a file whose text is searchable.
  if (!status || status === "ready") return null;

  // The bytes never left this phone. The only state here anyone can act on.
  if (status === "failed" && material.uri) {
    const retry = async () => {
      if (retrying) return;
      impact("light");
      setRetrying(true);
      await uploadMaterial(material);
      // No state to clear on success — the row re-renders from the material's
      // own status, which the upload has already moved on.
      setRetrying(false);
    };

    return (
      <View className="flex-row items-center mt-2">
        <CircleAlert size={13} color={COLORS.danger} strokeWidth={2} />

        <Text className="font-jk-med text-ink text-[12.5px] ml-1.5">
          {retrying ? "Trying again…" : "Couldn't upload"}
        </Text>

        {retrying ? null : (
          <>
            {/* A dot, not a gap: at this size two words separated by space
                read as one phrase, and "Retry" has to look pressable. */}
            <Text className="font-jk text-faint text-[12.5px] mx-1.5">·</Text>

            <Pressable
              onPress={retry}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Retry uploading ${material.title}`}
              className="active:opacity-60"
            >
              <Text className="font-jk-med text-primary text-[12.5px]">Retry</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  // The quiet states. One line, muted, no action — there is nothing anyone
  // can do about any of them from here.
  const line =
    status === "uploading"
      ? "Uploading…"
      : status === "queued"
        ? "Waiting to upload"
        : status === "unreadable" || status === "failed"
          ? // Stored, but no text came out of it — a scan of a photocopy, or a
            // PDF that is images all the way down. Worth saying plainly: the
            // file is safe and openable, the tutor just cannot revise from it.
            "Saved, but no text could be read from it"
          : "Reading it now, searchable shortly";

  return (
    <View className="flex-row items-center mt-2">
      <CloudUpload size={13} color={COLORS.faint} strokeWidth={1.8} />
      <Text className="font-jk text-muted text-[12.5px] ml-1.5">{line}</Text>
    </View>
  );
}
