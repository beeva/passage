import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

/** The one invariant that matters most for a citation system: every chunk's text must be exactly the source substring its own offsets point at - never a reconstructed string that merely looks similar. */
function expectOffsetsMatchSource(source: string, chunks: ReturnType<typeof chunkText>) {
  for (const chunk of chunks) {
    expect(source.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text);
  }
}

describe("chunkText", () => {
  it("returns a single chunk for a single short paragraph", () => {
    const source = "Refunds are processed within seven business days of approval.";
    const chunks = chunkText(source);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(source);
    expectOffsetsMatchSource(source, chunks);
  });

  it("merges consecutive short paragraphs into one chunk while they stay under the max length", () => {
    const source = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const chunks = chunkText(source);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toContain("First paragraph.");
    expect(chunks[0]!.text).toContain("Third paragraph.");
    expectOffsetsMatchSource(source, chunks);
  });

  it("starts a new chunk once adding the next paragraph would exceed the max length", () => {
    const paragraphA = "A".repeat(600);
    const paragraphB = "B".repeat(600);
    const source = `${paragraphA}\n\n${paragraphB}`;
    const chunks = chunkText(source);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.text).toBe(paragraphA);
    expect(chunks[1]!.text).toBe(paragraphB);
    expectOffsetsMatchSource(source, chunks);
  });

  it("never splits a single paragraph even when it exceeds the max chunk length on its own", () => {
    const longParagraph = "word ".repeat(400).trim(); // ~2000 chars, no paragraph breaks at all
    const chunks = chunkText(longParagraph);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(longParagraph);
  });

  it("greedily merges a short trailing paragraph into the previous chunk whenever it still fits", () => {
    const bigParagraph = "word ".repeat(150).trim(); // ~750 chars
    const shortTrailer = "One more short note.";
    const source = `${bigParagraph}\n\n${shortTrailer}`;
    const chunks = chunkText(source);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(source);
    expectOffsetsMatchSource(source, chunks);
  });

  it("starts a new chunk for a short trailing paragraph when merging it would exceed the max length", () => {
    const bigParagraph = "word ".repeat(200).trim(); // 999 chars - already at the cap on its own
    const shortTrailer = "One more short note.";
    const source = `${bigParagraph}\n\n${shortTrailer}`;
    const chunks = chunkText(source);

    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.text).toBe(shortTrailer);
    expectOffsetsMatchSource(source, chunks);
  });

  it("preserves real char offsets across irregular whitespace between paragraphs (not a synthesized separator)", () => {
    const source = "First.\n\n\n\n   Second, with extra blank lines and leading spaces before it.";
    const chunks = chunkText(source);
    expectOffsetsMatchSource(source, chunks);
  });

  it("trims leading/trailing whitespace from the document as a whole", () => {
    const source = "\n\n  Hello there.  \n\n";
    const chunks = chunkText(source);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe("Hello there.");
  });

  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n   ")).toEqual([]);
  });
});
