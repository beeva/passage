import { tokenize } from "./tokenize";
import { buildBM25Index, scoreBM25 } from "./bm25";
import { buildVectorSpaceIndex, scoreVectorSpace } from "./vectorspace";
import { reciprocalRankFusion } from "./hybrid";

export interface SearchablePassage {
  id: number;
  text: string;
}

export interface SearchResult {
  id: number;
  rrfScore: number;
  /** The vector-space cosine similarity of this passage to the query - used as the confidence signal for the refusal decision in answer.ts, independent of how the two rankings were fused. */
  confidence: number;
}

/**
 * Runs both retrieval methods over the same corpus and query, then fuses
 * them by rank (see hybrid.ts) rather than picking one - BM25 rewards
 * exact term overlap and document-length normalization; the vector-space
 * cosine score rewards a passage whose overall term distribution is
 * similar to the query's, even when the exact words differ slightly.
 * Building both indexes per-call rather than caching them keeps this
 * function pure and safe to call with a different (permission-filtered)
 * passage set on every query - see the workspace-scoped caller in
 * queries.ts.
 */
export function hybridSearch(passages: SearchablePassage[], query: string): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || passages.length === 0) return [];

  const tokenizedDocs = passages.map((p) => ({ id: p.id, tokens: tokenize(p.text) }));

  const bm25Results = scoreBM25(buildBM25Index(tokenizedDocs), queryTokens);
  const vsResults = scoreVectorSpace(buildVectorSpaceIndex(tokenizedDocs), queryTokens);

  const fused = reciprocalRankFusion([bm25Results, vsResults]);
  const confidenceById = new Map(vsResults.map((r) => [r.id, r.score]));

  return fused.map((r) => ({ id: r.id, rrfScore: r.rrfScore, confidence: confidenceById.get(r.id) ?? 0 }));
}
