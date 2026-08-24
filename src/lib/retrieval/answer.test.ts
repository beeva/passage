import { describe, expect, it } from "vitest";
import { selectAnswer } from "./answer";

const passages = [
  { id: 1, text: "The Eiffel Tower is located in Paris, France, and was completed in 1889." },
  { id: 2, text: "The Great Wall of China stretches for thousands of miles across the north." },
  { id: 3, text: "Passage.app processes refunds within five to seven business days of approval." },
];

describe("selectAnswer", () => {
  it("answers with the clearly relevant passage and a real confidence score", () => {
    const result = selectAnswer(passages, "Where is the Eiffel Tower?");
    expect(result.refused).toBe(false);
    if (!result.refused) {
      expect(result.passageId).toBe(1);
      expect(result.confidence).toBeGreaterThan(0);
    }
  });

  it("refuses a question with no relevant passage in the corpus, rather than returning the least-bad match", () => {
    const result = selectAnswer(passages, "What is the boiling point of nitrogen?");
    expect(result).toEqual({ refused: true, passageId: null, confidence: 0 });
  });

  it("refuses an empty question", () => {
    const result = selectAnswer(passages, "");
    expect(result.refused).toBe(true);
  });

  it("refuses against an empty document set", () => {
    const result = selectAnswer([], "Where is the Eiffel Tower?");
    expect(result).toEqual({ refused: true, passageId: null, confidence: 0 });
  });

  it("answers a narrow, specific question against its own clearly matching passage", () => {
    const result = selectAnswer(passages, "How long do refunds take to process?");
    expect(result.refused).toBe(false);
    if (!result.refused) expect(result.passageId).toBe(3);
  });

  it("still answers a clearly matching question against a single-passage corpus - a brand new workspace's first document", () => {
    // The exact scenario an unsmoothed TF-IDF IDF breaks: with only one
    // passage in the whole corpus, every one of its terms technically
    // "appears in every document," which collapses plain ln(N/df) to
    // exactly 0 and makes cosine similarity 0 no matter what's asked.
    // Found live against a real freshly created workspace with one real
    // uploaded document - every single query refused, regardless of how
    // well it actually matched.
    const onePassage = [{ id: 1, text: "Annual salary reviews happen every January, with merit increases of two to six percent." }];
    const result = selectAnswer(onePassage, "When do salary reviews happen?");
    expect(result.refused).toBe(false);
    if (!result.refused) {
      expect(result.passageId).toBe(1);
      expect(result.confidence).toBeGreaterThan(0);
    }
  });
});
