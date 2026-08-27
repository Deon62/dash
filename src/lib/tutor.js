import { fetch as streamingFetch } from "expo/fetch";

import { API_BASE_URL, API_V1, OFFLINE } from "@/api/client";
import { tutor as tutorApi } from "@/api/endpoints";
import { accessToken, authed, refreshSession, NOT_SIGNED_IN } from "@/lib/session";

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
} = {}) {
  const token = await accessToken();
  if (!token) return { text: "", sources: [], error: NOT_SIGNED_IN, status: 401 };

  const first = await openStream({ question, chatId, unitCode, model, token, signal });

  // A token revoked early — the account signed in on another handset, or the
  // server restarted — is the one failure worth a second attempt. Anything
  // else is reported as it came.
  if (first.status !== 401) return readStream(first, { onMeta, onToken });

  const fresh = await refreshSession();
  if (!fresh) return { text: "", sources: [], error: NOT_SIGNED_IN, status: 401 };

  const retry = await openStream({
    question,
    chatId,
    unitCode,
    model,
    token: fresh,
    signal,
  });

  return readStream(retry, { onMeta, onToken });
}

async function openStream({ question, chatId, unitCode, model, token, signal }) {
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

      release();
      return { status: response.status, error: message };
    }

    return { status: response.status, response, release };
  } catch (error) {
    release();

    return {
      status: 0,
      error:
        error?.name === "AbortError"
          ? "The answer was taking too long, so it was stopped."
          : OFFLINE,
    };
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
          onToken?.(parsed.data.text ?? "", text);
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
  return { text, sources, chatId, model, error: failure, status: 200 };
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
      prompt: question.prompt,
      options: question.options ?? [],
      answer: question.answer,
      explanation: question.explanation ?? "",
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
 * Each note as a two-sided card: title on the front, opening lines behind.
 *
 * Built on the device rather than asked for, and deliberately so — this is a
 * different view of material already synced down, not a new answer, and a
 * round trip to re-cut text the app is already holding would only make it
 * slower and unavailable underground.
 */
export function buildFlashcards(materials, { count = 12 } = {}) {
  return materials
    .filter((material) => (material.body ?? "").length > 0)
    .slice(0, count)
    .map((material) => ({
      id: material.id,
      front: material.title,
      back: trim(firstPassage(material) ?? material.body, 220),
      unitId: material.unitId,
    }));
}

/** The opening thought of a note — a person would call it the first sentence. */
function firstPassage(material) {
  // Blank lines first, then sentence ends inside the block. Two passes rather
  // than one regex because the lookbehind that would do it in one is not safe
  // to rely on in Hermes.
  return String(material.body ?? "")
    .split(/\n{2,}/)
    .flatMap((block) => block.match(/[^.!?\n]+[.!?]*/g) ?? [])
    .map((passage) => passage.trim())
    .find((passage) => passage.length > 24);
}

function trim(text, max = 320) {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}
