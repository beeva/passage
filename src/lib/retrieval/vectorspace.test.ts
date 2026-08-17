import { describe, expect, it } from "vitest";
import { buildQueryVector, buildVectorSpaceIndex, cosineSimilarity, scoreVectorSpace } from "./vectorspace";

// Hand-computed against a 3-document corpus with a shared vocabulary:
//   D1: "cats love yarn"   D2: "dogs love bones"   D3: "cats and dogs"
// idf(cats)=idf(love)=idf(dogs)=ln(3/2)~=0.405465; idf(yarn)=idf(bones)=idf(and)=ln(3)~=1.098612
// query "cats yarn": D1 shares both terms (cosine ~= 0.9449), D3 shares
// only "cats" (cosine ~= 0.1133), D2 shares neither (cosine 0, excluded).
const documents = [
  { id: 1, tokens: "cats love yarn".split(" ") },
  { id: 2, tokens: "dogs love bones".split(" ") },
  { id: 3, tokens: "cats and dogs".split(" ") },
];

describe("buildVectorSpaceIndex", () => {
  it("gives a term that appears in every document zero IDF weight", () => {
    const index = buildVectorSpaceIndex([
      { id: 1, tokens: ["shared", "unique_a"] },
      { id: 2, tokens: ["shared", "unique_b"] },
    ]);
    expect(index.idf.get("shared")).toBe(0);
    expect(index.idf.get("unique_a")).toBeGreaterThan(0);
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
    expect(results[0]!.score).toBeCloseTo(0.9449, 3);
    expect(results[1]).toMatchObject({ id: 3 });
    expect(results[1]!.score).toBeCloseTo(0.1133, 3);
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
