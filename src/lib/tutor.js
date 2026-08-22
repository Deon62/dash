/**
 * The study tutor, running entirely on the device.
 *
 * This is the retrieval half of the eventual RAG loop and none of the
 * generation half: it scores the student's own notes against the question and
 * hands back the passages that matched, labelled with where they came from.
 * When a model is wired in, `answer()` is the seam — the same ranked passages
 * become its context, and only the prose around them changes.
 *
 * Answers therefore never invent anything. A student revising from this sees
 * their own words or an honest "nothing filed on that yet".
 */

/** Words too common to say anything about which note is relevant. */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "of", "in",
  "on", "at", "to", "for", "with", "and", "or", "but", "if", "then", "than",
  "that", "this", "these", "those", "it", "its", "as", "by", "from", "into",
  "about", "what", "why", "how", "when", "where", "which", "who", "whom", "do",
  "does", "did", "can", "could", "should", "would", "will", "shall", "may",
  "might", "me", "my", "i", "you", "your", "we", "our", "us", "explain", "tell",
  "describe", "define", "give", "show", "help", "please", "again", "quiz",
]);

const MIN_TERM_LENGTH = 3;

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    // ASCII-only classes on purpose: Hermes has shipped without Unicode
    // property escapes, and a regex that fails to parse takes the bundle down
    // rather than degrading.
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= MIN_TERM_LENGTH && !STOP_WORDS.has(word));
}

/** Splits a note into passages a person would recognise as one thought. */
export function passagesOf(material) {
  // Blank lines first, then sentence ends inside each block. Two passes rather
  // than one regex because the lookbehind that would do it in one is not safe
  // to rely on in Hermes.
  return String(material.body ?? "")
    .split(/\n{2,}/)
    .flatMap((block) => block.match(/[^.!?\n]+[.!?]*/g) ?? [])
    .map((passage) => passage.trim())
    .filter((passage) => passage.length > 24);
}

/**
 * Ranks every passage in scope against the question.
 *
 * Scoring is term overlap weighted by how rare the term is across the corpus —
 * plain TF-IDF, which is enough to beat keyword matching on a few hundred notes
 * and needs no model on the device.
 */
export function retrieve(question, materials, { limit = 4 } = {}) {
  const terms = tokenize(question);
  if (terms.length === 0 || materials.length === 0) return [];

  const chunks = materials.flatMap((material) =>
    passagesOf(material).map((text) => ({
      text,
      material,
      terms: new Set(tokenize(text)),
    }))
  );

  if (chunks.length === 0) return [];

  // How many passages each term appears in — a term in every note tells us
  // nothing, a term in one note tells us almost everything.
  const documentFrequency = new Map();
  for (const chunk of chunks) {
    for (const term of chunk.terms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const scored = chunks.map((chunk) => {
    let score = 0;

    for (const term of terms) {
      if (!chunk.terms.has(term)) continue;
      score += Math.log(1 + chunks.length / (documentFrequency.get(term) ?? 1));
    }

    // A title match is a strong signal the student filed this deliberately.
    const titleTerms = new Set(tokenize(chunk.material.title));
    for (const term of terms) if (titleTerms.has(term)) score += 0.75;

    return { ...chunk, score };
  });

  return scored
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function trim(text, max = 320) {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Builds a reply to a question.
 *
 * Returns `{ text, sources }` where `sources` are the materials the answer was
 * drawn from, so the screen can show the student exactly which of their notes
 * is talking.
 */
export function answer(question, { materials, unit, limit = 4 }) {
  const scope = unit ? unit.code : "your units";

  if (materials.length === 0) {
    return {
      text: `There is nothing filed under ${scope} yet, so I have nothing to revise from. Add a note or a lecture summary in Knowledge and ask me again.`,
      sources: [],
    };
  }

  // `limit` comes from the plan: how many passages an answer may quote is the
  // part of the tiered "source citations" promise this can honestly deliver.
  const hits = retrieve(question, materials, { limit });

  if (hits.length === 0) {
    const titles = materials
      .slice(0, 3)
      .map((material) => `“${material.title}”`)
      .join(", ");

    return {
      text: `Nothing in ${scope} matches that. What you do have on file: ${titles}${
        materials.length > 3 ? `, and ${materials.length - 3} more` : ""
      }. Try wording it the way your notes do, or file the lecture it came from.`,
      sources: [],
    };
  }

  const body = hits
    .map((hit, index) => `${index + 1}. ${trim(hit.text)}\n— ${hit.material.title}`)
    .join("\n\n");

  const sources = [...new Map(hits.map((hit) => [hit.material.id, hit.material])).values()];

  return {
    text: `From your ${scope} material:\n\n${body}`,
    sources,
  };
}

/**
 * Turns notes into cloze questions.
 *
 * The blanked word is the rarest one in the sentence, which is close enough to
 * "the term being defined" to be worth answering — a blanked "the" would not be.
 */
export function buildQuiz(materials, { count = 5 } = {}) {
  const sentences = materials.flatMap((material) =>
    passagesOf(material).map((text) => ({ text, material }))
  );

  const frequency = new Map();
  for (const sentence of sentences) {
    for (const term of tokenize(sentence.text)) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
    }
  }

  const questions = [];

  for (const sentence of shuffle(sentences)) {
    const terms = tokenize(sentence.text);
    // Blanking the word a sentence opens with leaves "______ is constant time
    // on average", which reads as a broken sentence rather than a question.
    const opener = terms[0];

    const candidates = terms
      .filter((term) => term.length > 4 && term !== opener)
      .sort((a, b) => (frequency.get(a) ?? 0) - (frequency.get(b) ?? 0));

    const target = candidates[0];
    if (!target) continue;

    const pattern = new RegExp(`\\b${target}\\b`, "i");
    if (!pattern.test(sentence.text)) continue;

    questions.push({
      id: `${sentence.material.id}-${questions.length}`,
      prompt: trim(sentence.text.replace(pattern, "______"), 240),
      answer: target,
      source: sentence.material.title,
      unitId: sentence.material.unitId,
    });

    if (questions.length >= count) break;
  }

  return questions;
}

/** Each note as a two-sided card: title on the front, opening lines behind. */
export function buildFlashcards(materials, { count = 12 } = {}) {
  return materials
    .filter((material) => material.body.length > 0)
    .slice(0, count)
    .map((material) => ({
      id: material.id,
      front: material.title,
      back: trim(passagesOf(material)[0] ?? material.body, 220),
      unitId: material.unitId,
    }));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
