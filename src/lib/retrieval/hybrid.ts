/**
 * Reciprocal Rank Fusion - combines two independently-ranked result lists
 * (BM25, TF-IDF cosine) into one ranking, using each item's RANK in each
 * list rather than trying to make two differently-scaled scores directly
 * comparable. The same technique real hybrid search systems
 * (Elasticsearch, OpenSearch) use to combine lexical and vector search.
 */
const RRF_K = 60;

export interface RankedId {
  id: number;
}

export interface FusedResult {
  id: number;
  rrfScore: number;
}

export function reciprocalRankFusion(rankings: RankedId[][]): FusedResult[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((item, index) => {
      const rank = index + 1; // 1-indexed, matching the RRF formula's convention
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (RRF_K + rank));
    });
  }
  return [...scores.entries()].map(([id, rrfScore]) => ({ id, rrfScore })).sort((a, b) => b.rrfScore - a.rrfScore);
}
