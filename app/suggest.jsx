import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CloudOff, TriangleAlert } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { OFFLINE } from "@/api/client";
import {
  COUNTER_FROM,
  MAX_LENGTH,
  MIN_LENGTH,
  sendFeatureRequest,
} from "@/lib/feedback";
import { notify } from "@/lib/haptics";

/**
 * One text box, one button, one dialog.
 *
 * That is the whole feature, and the restraint is the point: every field on a
 * form like this is a reason not to fill it in, and what is being collected is
 * the sentence somebody types the moment the app cannot do the thing they
 * opened it for. So there is no title field, no category picker, and no list
 * of what you have sent before — a list of your own requests has exactly one
 * honest state, a paragraph with no answer beside it, and that reads as being
 * ignored rather than as being heard.
 *
 * Sent, and not sent, are the same dialog with the icon and the words swapped.
 * A separate error toast is where the paragraph someone just typed gets lost.
 */

/**
 * The draft, kept for the session and not a moment longer.
 *
 * Module scope rather than the store, because the store persists to
 * AsyncStorage: an unsent idea resurfacing a week later is confusing, and it
 * is not the student's content the way a note is. Here it survives going back
 * to Profile and returning — a fat-fingered back gesture does not cost the
 * paragraph — and dies with the app.
 */
let draft = "";

export default function SuggestScreen() {
  const router = useRouter();

  const [text, setText] = useState(draft);
  const [sending, setSending] = useState(false);

  /**
   * The dialog, as `{ message, failed }` or null.
   *
   * One piece of state for both outcomes, so the two can never be on screen at
   * once and neither can be left behind when the other opens.
   */
  const [result, setResult] = useState(null);

  const write = (next) => {
    draft = next;
    setText(next);
  };

  // Disabled until it is long enough is what makes the server's 400 — "tell us
  // a little more" — unreachable in practice, and `maxLength` below does the
  // same for the 422.
  const canSend = text.trim().length >= MIN_LENGTH && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);

    const { message, error } = await sendFeatureRequest(text);

    setSending(false);

    if (error) {
      // The server's own words, verbatim. It is the side that knows whether
      // this was too short, the sixth one today, or a session that has ended,
      // and every one of those messages is already written for a student to
      // read. The text stays in the box either way.
      setResult({ message: error, failed: true, offline: error === OFFLINE });
      return;
    }

    notify("success");
    // Cleared only on a send that landed. This is also the one path that
    // discards the session draft.
    write("");
    setResult({ message, failed: false });
  };

  const close = () => {
    const sent = result && !result.failed;
    setResult(null);
    // Back to Profile on a send that landed — the page equivalent of the sheet
    // closing behind it, and there is nothing left to do here. A failure stays
    // put, with the text still in the box to retry.
    if (sent) router.back();
  };

  const counting = text.length >= COUNTER_FROM;

  return (
    <Screen bare keyboardAware name="suggest">
      <ScreenHeader title="What should we build?" />

      <View className="gap-y-6">
        <Text className="font-jk text-muted text-[13.5px] leading-[20px] -mt-2">
          Tell us what would make revision easier. We read every one.
        </Text>

        <View>
          <TextField
            value={text}
            onChangeText={write}
            placeholder="I wish the app could…"
            multiline
            autoFocus
            maxLength={MAX_LENGTH}
            // Roughly five lines. Big enough that a paragraph does not feel
            // like it is being squeezed into a search box, which is what a
            // single-line field would tell someone to write.
            style={{ minHeight: 132, textAlignVertical: "top" }}
          />

          {/* Only near the ceiling. A counter that is always on nags for the
              length of every sentence anyone writes. */}
          {counting ? (
            <Text className="font-jk text-muted text-[11.5px] text-right mt-2">
              {text.length} / {MAX_LENGTH}
            </Text>
          ) : null}
        </View>

        {/* The spinner is on the button, not over the page: this is one insert
            and it answers in well under a second. Disabled while it is in
            flight is also the whole double-submit guard — a client-side check
            for identical text would throw away the fact that somebody cared
            enough to send it twice. */}
        <Button
          label="Send"
          busyLabel="Sending…"
          busy={sending}
          disabled={!canSend}
          onPress={send}
        />
      </View>

      <ConfirmDialog
        visible={Boolean(result)}
        Icon={
          result?.failed ? (result.offline ? CloudOff : TriangleAlert) : undefined
        }
        iconTone={result?.failed ? "danger" : "ink"}
        title={result?.failed ? "Not sent" : "Thank you"}
        message={result?.message}
        confirmLabel="Done"
        onConfirm={close}
        // The same close on a tap outside and on the Android back gesture.
        // Without it neither does anything, and a dialog with one button and
        // no way past it is a trap.
        onDismiss={close}
      />
    </Screen>
  );
}
