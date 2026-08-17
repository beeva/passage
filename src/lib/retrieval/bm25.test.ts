import { describe, expect, it } from "vitest";
import { buildBM25Index, scoreBM25 } from "./bm25";

// A 3-document corpus with hand-computed expected scores, so this test
// verifies the actual formula (k1=1.5, b=0.75, BM25+ smoothed IDF), not
// just "some document scored higher than another."
//   D1: "the cat sat on the mat"   (6 tokens)
//   D2: "the dog sat on the log"   (6 tokens)
//   D3: "cats and dogs are pets"   (5 tokens)
// avgdl = 17/3
// query "cat sat": df(cat)=1, df(sat)=2
//   idf(cat) = ln((3-1+0.5)/(1+0.5)+1) = ln(2.6666...) ~= 0.98083
//   idf(sat) = ln((3-2+0.5)/(2+0.5)+1) = ln(1.6)       ~= 0.47000
// D1 has both terms (tf=1 each, len=6): score ~= 1.41341
// D2 has only "sat" (tf=1, len=6):      score ~= 0.45787
// D3 has neither term: score 0, excluded
const documents = [
  { id: 1, tokens: "the cat sat on the mat".split(" ") },
  { id: 2, tokens: "the dog sat on the log".split(" ") },
  { id: 3, tokens: "cats and dogs are pets".split(" ") },
];

describe("buildBM25Index", () => {
  it("computes document frequency and average document length across the corpus", () => {
    const index = buildBM25Index(documents);
    expect(index.totalDocuments).toBe(3);
    expect(index.avgDocLength).toBeCloseTo(17 / 3, 10);
    expect(index.documentFrequency.get("the")).toBe(2);
    expect(index.documentFrequency.get("sat")).toBe(2);
    expect(index.documentFrequency.get("cat")).toBe(1);
    expect(index.documentFrequency.get("pets")).toBe(1);
  });

  it("returns zero average length and an empty index for an empty corpus", () => {
    const index = buildBM25Index([]);
    expect(index.totalDocuments).toBe(0);
    expect(index.avgDocLength).toBe(0);
  });
});

describe("scoreBM25", () => {
  it("matches the hand-computed BM25 score for a two-term query", () => {
    const index = buildBM25Index(documents);
    const results = scoreBM25(index, ["cat", "sat"]);

    expect(results).toHaveLength(2); // D3 scores 0 and is excluded
    expect(results[0]).toMatchObject({ id: 1 });
    expect(results[0]!.score).toBeCloseTo(1.41341, 4);
    expect(results[1]).toMatchObject({ id: 2 });
    expect(results[1]!.score).toBeCloseTo(0.45787, 4);
  });

  it("ranks the document containing the rarer term higher", () => {
    // "cat" (df=1) is rarer than "sat" (df=2) in this corpus, so a
    // document matching only "cat" should outscore the same-length
    // document with equal term frequency matching only "sat".
    const index = buildBM25Index(documents);
    const catOnly = scoreBM25(index, ["cat"]);
    const satOnly = scoreBM25(index, ["sat"]);
    expect(catOnly[0]!.score).toBeGreaterThan(satOnly[0]!.score);
  });

  it("returns an empty array for a query with no terms", () => {
    const index = buildBM25Index(documents);
    expect(scoreBM25(index, [])).toEqual([]);
  });

  it("returns an empty array when no document contains any query term", () => {
    const index = buildBM25Index(documents);
    expect(scoreBM25(index, ["xylophone"])).toEqual([]);
  });

  it("returns an empty array against an empty corpus without dividing by zero", () => {
    const index = buildBM25Index([]);
    expect(scoreBM25(index, ["cat"])).toEqual([]);
  });

  it("counts a repeated query term once for ranking purposes (deduplicates query terms)", () => {
    const index = buildBM25Index(documents);
    const once = scoreBM25(index, ["cat"]);
    const repeated = scoreBM25(index, ["cat", "cat", "cat"]);
    expect(repeated[0]!.score).toBeCloseTo(once[0]!.score, 10);
  });
});
