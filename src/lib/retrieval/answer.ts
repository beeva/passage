import { hybridSearch, type SearchablePassage } from "./search";

// Below this cosine similarity, the top-ranked passage isn't actually
// about the same thing the question is - refusing is more useful than an
// answer that merely happens to rank first among bad options. Tuned
// against the eval fixtures (scripts/evals.ts), where it sits between two
// real, opposing failure cases from that fixture set: a legitimately
// relevant question that shares almost no literal words with its answer
// scores 0.116 (just under this threshold - a real false refusal), and a
// genuinely unrelated question that happens to share one coincidentally
// distinctive word with an unrelated passage scores 0.147 (just over it -
// a real false match). No single threshold value fixes both at once; run
// `npm run evals` to see the exact numbers. This is a real precision/
// recall tradeoff inherent to lexical retrieval without true semantic
// embeddings, not a bug to chase - moving the threshold trades one
// specific failure for the other, not a net improvement.
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
