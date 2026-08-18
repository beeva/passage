import { describe, expect, it } from "vitest";
import { hybridSearch } from "./search";

const passages = [
  { id: 1, text: "The Eiffel Tower is located in Paris, France, and was completed in 1889." },
  { id: 2, text: "The Great Wall of China stretches for thousands of miles across the north." },
  { id: 3, text: "Paris is also known for its art museums, cafes, and wide boulevards." },
];

describe("hybridSearch", () => {
  it("ranks the passage sharing the most distinctive query terms first", () => {
    const results = hybridSearch(passages, "Where is the Eiffel Tower located?");
    expect(results[0]).toMatchObject({ id: 1 });
  });

  it("still surfaces a passage that only shares the less-distinctive term (Paris)", () => {
    const results = hybridSearch(passages, "What is Paris known for?");
    const ids = results.map((r) => r.id);
    expect(ids).toContain(3);
    expect(ids).toContain(1); // "Paris" also appears in passage 1
  });

  it("returns nothing for a query that shares no terms with the corpus", () => {
    const results = hybridSearch(passages, "quantum spreadsheet velocity");
    expect(results).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(hybridSearch(passages, "")).toEqual([]);
  });

  it("returns nothing against an empty passage set", () => {
    expect(hybridSearch([], "Eiffel Tower")).toEqual([]);
  });

  it("every result carries a confidence in [0, 1] (the vector-space cosine score)", () => {
    const results = hybridSearch(passages, "Eiffel Tower Paris museums");
    for (const result of results) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
