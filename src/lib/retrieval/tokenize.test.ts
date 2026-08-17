import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenize";

describe("tokenize", () => {
  it("lowercases, splits on whitespace, and drops stopwords", () => {
    expect(tokenize("The Quick Brown Fox")).toEqual(["quick", "brown", "fox"]);
  });

  it("strips punctuation, keeping alphanumeric runs, and drops stopwords", () => {
    expect(tokenize("Well, that's — surprising!")).toEqual(["well", "surprising"]);
  });

  it("keeps digits as part of tokens", () => {
    expect(tokenize("Q3 2024 revenue was $4.2M")).toEqual(["q3", "2024", "revenue", "4", "2m"]);
  });

  it("drops common function words that carry no topical meaning", () => {
    expect(tokenize("What is the boiling point of nitrogen?")).toEqual(["boiling", "point", "nitrogen"]);
  });

  it("can return an empty array when a whole sentence is stopwords", () => {
    expect(tokenize("This is that")).toEqual([]);
  });

  it("returns an empty array for text with no word characters", () => {
    expect(tokenize("--- ... !!!")).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});
