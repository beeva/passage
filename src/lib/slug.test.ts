import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("The Room Tone Show")).toBe("the-room-tone-show");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Hello, World! -- Take 2")).toBe("hello-world-take-2");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --Weird Title--  ")).toBe("weird-title");
  });

  it("handles an already-clean slug unchanged", () => {
    expect(slugify("already-a-slug")).toBe("already-a-slug");
  });

  it("truncates very long titles to a sane length", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBe(100);
  });
});
