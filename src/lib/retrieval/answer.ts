import { hybridSearch, type SearchablePassage } from "./search";

// Below this cosine similarity, the top-ranked passage isn't actually
// about the same thing the question is - refusing is more useful than an
// answer that merely happens to rank first among bad options. Tuned
// against the eval fixtures (scripts/evals.ts): high enough to reject
// genuinely off-topic questions, low enough not to refuse legitimate
// short/sparse questions against a small corpus.
export const CONFIDENCE_THRESHOLD = 0.12;

export type AnswerResult =
  | { refused: false; passageId: number; confidence: number }
  | { refused: true; passageId: null; confidence: number };

/**
 * The whole point of this function: an answer is never synthesized text
 * that has to be independently checked against the source - it's either
 * the top-ranked passage itself (by id, resolved to real text by the
 * caller) or an honest refusal. There is no third option where a
 * low-confidence match gets returned anyway with a caveat attached.
 */
export function selectAnswer(passages: SearchablePassage[], query: string): AnswerResult {
  const results = hybridSearch(passages, query);
  const top = results[0];

  if (!top || top.confidence < CONFIDENCE_THRESHOLD) {
    return { refused: true, passageId: null, confidence: top?.confidence ?? 0 };
  }

  return { refused: false, passageId: top.id, confidence: top.confidence };
}
