/**
 * Okapi BM25 - the ranking function behind most real full-text search
 * (Elasticsearch/Lucene's default scorer is a BM25 variant). Implemented
 * directly from the standard formula rather than pulled in as a
 * dependency, so every constant and step is inspectable and testable
 * against hand-computed values.
 */
export interface BM25Document {
  id: number;
  tokens: string[];
}

export interface BM25Index {
  documents: { id: number; termCounts: Map<string, number>; length: number }[];
  documentFrequency: Map<string, number>;
  avgDocLength: number;
  totalDocuments: number;
}

export interface BM25Result {
  id: number;
  score: number;
}

// Standard defaults from the original Okapi BM25 paper - k1 controls how
// quickly additional occurrences of a term stop adding score (term
// frequency saturation), b controls how much a document's length is
// penalized relative to the corpus average.
const K1 = 1.5;
const B = 0.75;

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

export function buildBM25Index(documents: BM25Document[]): BM25Index {
  const indexed = documents.map((doc) => ({ id: doc.id, termCounts: countTerms(doc.tokens), length: doc.tokens.length }));

  const documentFrequency = new Map<string, number>();
  for (const doc of indexed) {
    for (const term of doc.termCounts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const totalDocuments = indexed.length;
  const avgDocLength = totalDocuments === 0 ? 0 : indexed.reduce((sum, doc) => sum + doc.length, 0) / totalDocuments;

  return { documents: indexed, documentFrequency, avgDocLength, totalDocuments };
}

/** The BM25+ smoothed IDF variant - the plain Robertson-Sparck-Jones IDF goes negative for a term that appears in more than half the corpus, which would make a very common term SUBTRACT from a document's score. Adding 1 inside the log keeps IDF non-negative for every term. */
function idf(index: BM25Index, term: string): number {
  const df = index.documentFrequency.get(term) ?? 0;
  return Math.log((index.totalDocuments - df + 0.5) / (df + 0.5) + 1);
}

export function scoreBM25(index: BM25Index, queryTokens: string[]): BM25Result[] {
  const uniqueQueryTerms = [...new Set(queryTokens)];
  if (uniqueQueryTerms.length === 0 || index.totalDocuments === 0) return [];

  const termIdf = new Map(uniqueQueryTerms.map((term) => [term, idf(index, term)]));

  const results: BM25Result[] = index.documents.map((doc) => {
    let score = 0;
    for (const term of uniqueQueryTerms) {
      const tf = doc.termCounts.get(term) ?? 0;
      if (tf === 0) continue;
      const numerator = tf * (K1 + 1);
      const denominator = tf + K1 * (1 - B + B * (doc.length / index.avgDocLength));
      score += (termIdf.get(term) ?? 0) * (numerator / denominator);
    }
    return { id: doc.id, score };
  });

  return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}
