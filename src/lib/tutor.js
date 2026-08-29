import { fetch as streamingFetch } from "expo/fetch";

import { API_BASE_URL, API_V1, OFFLINE } from "@/api/client";
import { recordFailure } from "@/lib/diagnostics";
import { tutor as tutorApi } from "@/api/endpoints";
import { accessToken, authed, refreshSession, NOT_SIGNED_IN } from "@/lib/session";
import { withinNoteLimit } from "@/lib/notes";

/**
 * The tutor.
 *
 * Retrieval happens on the server, over everything the student has filed —
 * including the text pulled out of PDFs, which the device never sees. That is
 * the difference between "nothing in your notes matches that" being a fact and
 * being a guess made from whatever this handset happened to have cached.
 *
 * An answer arrives as server-sent events rather than as JSON. A grounded
 * answer takes several seconds to generate and a student watching a spinner
 * for six of them assumes it has hung; streaming also degrades honestly, since
 * a connection that drops mid-answer leaves them with the part that arrived.
 *
 * `expo/fetch` rather than the global one: React Native's `fetch` has no
 * readable body, so the global would buffer the whole answer and hand it over
 * in one lump — the exact thing streaming exists to avoid.
 */

/**
 * Em and en dashes, written the way a person types.
 *
 * A model reaches for `—` constantly, and it is the single strongest tell that
 * an answer was generated rather than written: nobody typing on a phone has
 * ever produced one. The answers are otherwise plain, so the punctuation is
 * what gives them away.
 *
 * Done here rather than by asking the model not to, because a system prompt is
 * a request the model follows most of the time, and "most of the time" is what
 * makes it noticeable — the one answer in six that still has them is the one a
 * student reads as machine-written. This is deterministic.
 *
 * Code is left exactly as it came. A dash inside a fenced block or a `code
 * span` is somebody's syntax, not their punctuation, and rewriting it turns a
 * working example into one that does not run.
 */
const CODE = /(```[\s\S]*?```|```[\s\S]*$|`[^`\n]*`)/g;

export function plainDashes(text) {
  if (!text) return text;

  return String(text)
    // The capture means the split keeps the code, at every odd index.
    .split(CODE)
    .map((part, index) => (index % 2 ? part : tidyDashes(part)))
    .join("");
}

function tidyDashes(part) {
  return (
    part
      // A dash opening a line is a bullet, whatever character was used for it.
      .replace(/^([^\S\n]*)[—–][^\S\n]*/gm, "$1- ")
      // `10–15`, `pp. 4–7`: a range, which a plain hyphen says just as well.
      .replace(/(\d)[^\S\n]*[—–][^\S\n]*(\d)/g, "$1-$2")
      // Everything else. Spaced, because an unspaced hyphen between words
      // reads as one hyphenated word rather than as a break in the sentence.
      // The newline is deliberately kept out of the whitespace either side:
      // eating it would pull two paragraphs onto one line.
      .replace(/[^\S\n]*[—–][^\S\n]*/g, " - ")
  );
}

/**
 * Long, on purpose.
 *
 * The budget for a streamed answer is not the budget for a JSON call: the
 * request is open for as long as the model is talking, and the ordinary
 * timeout in `src/api/client.js` would cut a good answer off in the middle.
 */
const STREAM_TIMEOUT_MS = 120000;

/**
 * Asks a question, grounded in the student's own material.
 *
 * `onToken` is called with each piece as it arrives, `onMeta` once before the
 * first one with the sources the answer is built from — so the citation header
 * can be drawn while the prose is still coming.
 *
 * Resolves to `{ text, sources, chatId, model, error, status }` and never
 * throws. `status` is 402 when a plan limit refused the question — the caller
 * has a different screen for that than for a failure.
 */
export async function askTutor({
  question,
  chatId = null,
  unitCode = null,
  model = null,
  onMeta,
  onToken,
  signal,
  // The ids the caller has already stored this turn under, so the server
  // records the same two rows instead of minting its own.
  studentMessageId = null,
  answerMessageId = null,
} = {}) {
  const token = await accessToken();
  if (!token) return { text: "", sources: [], error: NOT_SIGNED_IN, status: 401 };

  const opening = {
    question,
    chatId,
    unitCode,
    model,
    signal,
    studentMessageId,
    answerMessageId,
  };

  const first = await openStream({ ...opening, token });

  // A token revoked early — the account signed in on another handset, or the
  // server restarted — is the one failure worth a second attempt. Anything
  // else is reported as it came.
  if (first.status !== 401) return readStream(first, { onMeta, onToken });

  const fresh = await refreshSession();
  if (!fresh) return { text: "", sources: [], error: NOT_SIGNED_IN, status: 401 };

  const retry = await openStream({ ...opening, token: fresh });

  return readStream(retry, { onMeta, onToken });
}

async function openStream({
  question,
  chatId,
  unitCode,
  model,
  token,
  signal,
  studentMessageId,
  answerMessageId,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onExternalAbort);

  const release = () => {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onExternalAbort);
  };

  try {
    const response = await streamingFetch(`${API_BASE_URL}${API_V1}/tutor/ask`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question,
        chat_id: chatId,
        unit_code: unitCode,
        model,
        // The ids this device is about to store the turn under. Sending them
        // means the server writes the same two rows rather than inventing its
        // own, which the next sync would otherwise pull down as duplicates —
        // every answer appearing twice, as though it had been asked twice.
        student_message_id: studentMessageId,
        answer_message_id: answerMessageId,
      }),
    });

    if (!response.ok) {
      // The stream never started, so the failure is an ordinary JSON envelope
      // and can be read as one.
      const text = await response.text();
      let message = `The tutor could not answer (${response.status}).`;
      try {
        message = JSON.parse(text)?.message ?? message;
      } catch {
        // Not JSON. The status line above is all there is to say.
      }

      recordFailure({
        source: "tutor",
        method: "POST",
        path: `${API_V1}/tutor/ask`,
        status: response.status,
        message,
        detail: text,
      });

      release();
      return { status: response.status, error: message };
    }

    return { status: response.status, response, release };
  } catch (error) {
    release();

    const aborted = error?.name === "AbortError";
    const message = aborted
      ? "The answer was taking too long, so it was stopped."
      : OFFLINE;

    recordFailure({
      source: "tutor",
      method: "POST",
      path: `${API_V1}/tutor/ask`,
      status: 0,
      message,
      detail: aborted ? "Aborted" : `${error?.name ?? "Error"}: ${error?.message ?? error}`,
    });

    return { status: 0, error: message };
  }
}

/**
 * Reads the frames.
 *
 * `meta` first, then many `token`s, then `done`. An `error` frame is how a
 * failure that happened *after* the headers went out reaches the student —
 * there is no status code left to change by then, so it travels inside the
 * stream and replaces the rest of the answer.
 */
async function readStream(opened, { onMeta, onToken }) {
  if (opened.error) {
    return { text: "", sources: [], error: opened.error, status: opened.status };
  }

  const { response, release } = opened;

  let text = "";
  let sources = [];
  let chatId = null;
  let model = null;
  let failure = null;

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. Anything after the last one is a
      // partial frame and stays in the buffer until the rest of it arrives —
      // parsing it early is how a stream loses a word every few kilobytes.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const parsed = parseFrame(frame);
        if (!parsed) continue;

        if (parsed.event === "meta") {
          chatId = parsed.data.chat_id ?? chatId;
          model = parsed.data.model ?? model;
          sources = parsed.data.sources ?? [];
          onMeta?.(parsed.data);
        } else if (parsed.event === "token") {
          text += parsed.data.text ?? "";
          // The whole answer each time, not the piece: cleaning a token on its
          // own cannot see whether the dash it holds is inside a code fence
          // that opened three tokens ago.
          onToken?.(parsed.data.text ?? "", plainDashes(text));
        } else if (parsed.event === "done") {
          if (parsed.data.text) text = parsed.data.text;
        } else if (parsed.event === "error") {
          failure = parsed.data.message ?? "Something went wrong on our side.";
        }
      }
    }
  } catch {
    // Whatever arrived before the connection went is still worth keeping: a
    // half-answer a student can read beats an error that throws it away.
    if (!text) failure = OFFLINE;
  } finally {
    release?.();
  }

  // A failure inside the stream is never a quota refusal — the allowance was
  // charged before the first frame went out — so the status stays 200.
  return { text: plainDashes(text), sources, chatId, model, error: failure, status: 200 };
}

function parseFrame(frame) {
  let event = "message";
  const data = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }

  if (data.length === 0) return null;

  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * A multiple-choice quiz over a unit or a topic.
 *
 * Not streamed: a quiz renders as cards and there is nothing to show until the
 * last question has been parsed and checked. `count` is a request, not a
 * promise — the server clamps it to whatever the plan allows.
 */
export async function buildQuiz({ unitCode = null, topic = null, count } = {}) {
  const { data, error, status } = await authed((token) =>
    tutorApi.quiz({ unitCode, topic, count }, token),
  );

  // 402 is the plan refusing, not the request failing. The caller shows a
  // different screen for each.
  if (error) return { questions: [], error, status };

  return {
    questions: (data.questions ?? []).map((question, index) => ({
      id: `${index}-${question.prompt.slice(0, 24)}`,
      prompt: plainDashes(question.prompt),
      options: (question.options ?? []).map(plainDashes),
      answer: plainDashes(question.answer),
      explanation: plainDashes(question.explanation ?? ""),
      source: question.source ?? "",
    })),
    grounded: Boolean(data.grounded),
    note: data.note ?? "",
    model: data.model ?? null,
    error: null,
    status,
  };
}

/** The model line-up, so the picker can show what is and is not switched on. */
export async function tutorModels() {
  const { data, error } = await authed((token) => tutorApi.models(token));
  if (error) return { models: [], default: null, error };

  return { models: data.models ?? [], default: data.default ?? null, error: null };
}

// --- Cards ------------------------------------------------------------------

/**
 * The short notes as two-sided cards: title on the front, the note behind.
 *
 * Built on the device rather than asked for, and deliberately so — this is a
 * different view of material already synced down, not a new answer, and a
 * round trip to re-cut text the app is already holding would only make it
 * slower and unavailable underground.
 *
 * **A card shows its note whole, or there is no card.** The deck used to cut
 * every note to its first sentence and 220 characters, so a student who had
 * written six lines turned one over and found one of them, with nothing to say
 * the rest existed — the frustrating kind of wrong, because it looks like the
 * app lost the note.
 *
 * Long material is not truncated now; it is simply not a card. It stays filed
 * and the tutor still reads all of it, which is the honest division of labour:
 * Ask is where a document is useful, and a deck is for the things short enough
 * to recall in one glance. `countCards` below is what lets the empty state say
 * so rather than implying nothing was filed.
 */
export function buildFlashcards(materials, { count = 12 } = {}) {
  return materials
    .filter((material) => cardable(material))
    .slice(0, count)
    .map((material) => ({
      id: material.id,
      front: material.title,
      back: String(material.body ?? "").trim(),
      unitId: material.unitId,
    }));
}

/** True where a material's whole body fits on a card. */
function cardable(material) {
  const body = String(material.body ?? "").trim();
  return body.length > 0 && withinNoteLimit(body);
}

/**
 * How the filed material divides between the deck and everything else.
 *
 * The count of what was left out is the difference between "you have not filed
 * anything" and "what you filed is too long to be a card", and those need
 * different things said to them.
 */
export function countCards(materials) {
  let cards = 0;
  let tooLong = 0;

  for (const material of materials) {
    if (cardable(material)) cards += 1;
    else if (String(material.body ?? "").trim().length > 0) tooLong += 1;
  }

  return { cards, tooLong };
}
