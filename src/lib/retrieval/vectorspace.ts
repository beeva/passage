/**
 * Classic TF-IDF vector space model - a second, independent retrieval
 * signal from BM25 (different weighting, different failure modes),
 * combined later by hybrid.ts. Every document (and the query itself) is
 * represented as a unit-length vector over the corpus vocabulary, so
 * cosine similarity between two vectors is just their dot product.
 */
export interface VSDocument {
  id: number;
  tokens: string[];
}

export interface VectorSpaceIndex {
  vectors: { id: number; vector: Map<string, number> }[];
  idf: Map<string, number>;
  totalDocuments: number;
}

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function normalize(vector: Map<string, number>): Map<string, number> {
  let sumSquares = 0;
  for (const weight of vector.values()) sumSquares += weight * weight;
  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) return vector;
  const normalized = new Map<string, number>();
  for (const [term, weight] of vector) normalized.set(term, weight / magnitude);
  return normalized;
}

export function buildVectorSpaceIndex(documents: VSDocument[]): VectorSpaceIndex {
  const totalDocuments = documents.length;
  const documentFrequency = new Map<string, number>();
  const termCountsByDoc = documents.map((doc) => ({ id: doc.id, length: doc.tokens.length, counts: countTerms(doc.tokens) }));

  for (const doc of termCountsByDoc) {
    for (const term of doc.counts.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }

  // Smoothed IDF (ln((1+N)/(1+df)) + 1, the same smoothing scikit-learn's
  // TfidfVectorizer uses by default) rather than the textbook ln(N/df) -
  // the plain formula collapses to EXACTLY 0 for every term whenever a
  // term appears in every document, which is guaranteed for every term
  // when the corpus has exactly one document in it. That's not a rare
  // edge case here - it's every brand-new workspace's first upload.
  // Found live: a real, correctly-extracted, correctly-chunked document
  // whose own workspace had nothing else indexed yet always came back
  // refused, at any confidence threshold, because cosine similarity
  // against an all-zero vector is 0 no matter how well the terms match.
  // The smoothed version never reaches 0, so it can't fully erase the
  // signal - it still ranks a document-unique term above a
  // every-document term, just without the degenerate floor.
  const idf = new Map<string, number>();
  for (const [term, df] of documentFrequency) idf.set(term, Math.log((1 + totalDocuments) / (1 + df)) + 1);

  const vectors = termCountsByDoc.map((doc) => {
    const raw = new Map<string, number>();
    for (const [term, count] of doc.counts) {
      const tf = count / doc.length;
      raw.set(term, tf * (idf.get(term) ?? 0));
    }
    return { id: doc.id, vector: normalize(raw) };
  });

  return { vectors, idf, totalDocuments };
}

/** Builds the query's own vector using the corpus's IDF weights - a query term absent from the corpus vocabulary (idf undefined) contributes nothing, the same as it would for any document. */
export function buildQueryVector(index: VectorSpaceIndex, queryTokens: string[]): Map<string, number> {
  const counts = countTerms(queryTokens);
  const raw = new Map<string, number>();
  for (const [term, count] of counts) {
    const idf = index.idf.get(term);
    if (idf === undefined) continue;
    raw.set(term, (count / queryTokens.length) * idf);
  }
  return normalize(raw);
}

/** Both vectors are already unit-length (see normalize()), so their dot product IS the cosine similarity - no separate magnitude division needed here. */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of smaller) {
    const other = larger.get(term);
    if (other !== undefined) dot += weight * other;
  }
  return dot;
}

export interface VectorSpaceResult {
  id: number;
  score: number;
}

export function scoreVectorSpace(index: VectorSpaceIndex, queryTokens: string[]): VectorSpaceResult[] {
  const queryVector = buildQueryVector(index, queryTokens);
  if (queryVector.size === 0) return [];

  return index.vectors
    .map((doc) => ({ id: doc.id, score: cosineSimilarity(queryVector, doc.vector) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
