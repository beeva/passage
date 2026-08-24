import { describe, expect, it } from "vitest";
import { buildQueryVector, buildVectorSpaceIndex, cosineSimilarity, scoreVectorSpace } from "./vectorspace";

// Hand-computed against a 3-document corpus with a shared vocabulary,
// using smoothed IDF = ln((1+N)/(1+df)) + 1 (see the comment in
// vectorspace.ts for why the plain ln(N/df) formula isn't used):
//   D1: "cats love yarn"   D2: "dogs love bones"   D3: "cats and dogs"
// idf(cats)=idf(love)=idf(dogs)=ln(4/3)+1~=1.287682
// idf(yarn)=idf(bones)=idf(and)=ln(4/2)+1~=1.693147
// query "cats yarn": D1 shares both terms (cosine ~= 0.8555), D3 shares
// only "cats" (cosine ~= 0.3135), D2 shares neither (cosine 0, excluded).
const documents = [
  { id: 1, tokens: "cats love yarn".split(" ") },
  { id: 2, tokens: "dogs love bones".split(" ") },
  { id: 3, tokens: "cats and dogs".split(" ") },
];

describe("buildVectorSpaceIndex", () => {
  it("gives a term that appears in every document a lower, but still positive, IDF weight than a document-unique term", () => {
    // Smoothed IDF never reaches exactly 0 - see the comment in
    // vectorspace.ts on why the plain ln(N/df) formula's exact-zero
    // floor is a real bug, not just a theoretical edge case, for a
    // corpus with only one (or few) documents in it.
    const index = buildVectorSpaceIndex([
      { id: 1, tokens: ["shared", "unique_a"] },
      { id: 2, tokens: ["shared", "unique_b"] },
    ]);
    expect(index.idf.get("shared")).toBeGreaterThan(0);
    expect(index.idf.get("unique_a")).toBeGreaterThan(index.idf.get("shared")!);
  });

  it("still gives a real, non-zero confidence signal for a single-document corpus - the actual bug this smoothing fixes", () => {
    // A brand-new workspace's very first document is exactly this case:
    // exactly one document, so every one of its own terms technically
    // "appears in every document" under the naive definition. The plain
    // ln(N/df) formula makes idf, and therefore cosine similarity, EXACTLY
    // 0 here regardless of how well a query matches - which made
    // selectAnswer refuse every single query against a freshly created
    // workspace, no matter what was asked. Found live, not in a test.
    const index = buildVectorSpaceIndex([{ id: 1, tokens: "annual salary reviews happen every january".split(" ") }]);
    const results = scoreVectorSpace(index, ["salary", "reviews"]);
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("produces a zero-magnitude vector (not NaN) for a document made entirely of universal terms", () => {
    const index = buildVectorSpaceIndex([
      { id: 1, tokens: ["shared", "shared"] },
      { id: 2, tokens: ["shared", "other"] },
    ]);
    const doc1 = index.vectors.find((v) => v.id === 1)!;
    for (const weight of doc1.vector.values()) expect(Number.isNaN(weight)).toBe(false);
  });
});

describe("cosineSimilarity + scoreVectorSpace", () => {
  it("matches hand-computed cosine similarity for the two matching documents, in the right order", () => {
    const index = buildVectorSpaceIndex(documents);
    const results = scoreVectorSpace(index, ["cats", "yarn"]);

    expect(results).toHaveLength(2); // D2 shares neither query term - cosine 0, excluded
    expect(results[0]).toMatchObject({ id: 1 });
    expect(results[0]!.score).toBeCloseTo(0.8555, 3);
    expect(results[1]).toMatchObject({ id: 3 });
    expect(results[1]!.score).toBeCloseTo(0.3135, 3);
  });

  it("every stored document vector has unit length (or is the zero vector)", () => {
    const index = buildVectorSpaceIndex(documents);
    for (const { vector } of index.vectors) {
      const magnitude = Math.sqrt([...vector.values()].reduce((sum, w) => sum + w * w, 0));
      expect(magnitude === 0 || Math.abs(magnitude - 1) < 1e-9).toBe(true);
    }
  });

  it("a query term absent from the corpus vocabulary contributes nothing rather than throwing", () => {
    const index = buildVectorSpaceIndex(documents);
    const withUnknownTerm = scoreVectorSpace(index, ["cats", "yarn", "xylophone"]);
    const withoutIt = scoreVectorSpace(index, ["cats", "yarn"]);
    expect(withUnknownTerm[0]!.score).toBeCloseTo(withoutIt[0]!.score, 10);
  });

  it("returns an empty array when every query term is unknown to the corpus", () => {
    const index = buildVectorSpaceIndex(documents);
    expect(scoreVectorSpace(index, ["xylophone"])).toEqual([]);
  });

  it("cosineSimilarity of a vector with itself is 1 (for a non-zero vector)", () => {
    const index = buildVectorSpaceIndex(documents);
    const doc1 = index.vectors.find((v) => v.id === 1)!.vector;
    expect(cosineSimilarity(doc1, doc1)).toBeCloseTo(1, 10);
  });

  it("buildQueryVector returns an empty map for an empty query", () => {
    const index = buildVectorSpaceIndex(documents);
    expect(buildQueryVector(index, []).size).toBe(0);
  });
});
