export interface Chunk {
  text: string;
  charStart: number;
  charEnd: number;
}

const MAX_CHUNK_LENGTH = 1000;

interface ParagraphSpan {
  charStart: number;
  charEnd: number;
}

/** Splits on runs of 2+ newlines (the usual paragraph break), returning each paragraph's TRIMMED boundaries in the ORIGINAL text - never a re-synthesized string - so a chunk built from these spans is always exactly source.slice(charStart, charEnd), whitespace and all. */
function splitIntoParagraphs(source: string): ParagraphSpan[] {
  const spans: ParagraphSpan[] = [];
  const regex = /\n{2,}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushSpan = (rawStart: number, rawEnd: number) => {
    const raw = source.slice(rawStart, rawEnd);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 0) spans.push({ charStart: rawStart + leading, charEnd: rawStart + leading + trimmed.length });
  };

  while ((match = regex.exec(source)) !== null) {
    pushSpan(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
  }
  pushSpan(lastIndex, source.length);

  return spans;
}

/**
 * Splits extracted document text into passages along paragraph
 * boundaries, greedily grouping consecutive paragraphs up to
 * MAX_CHUNK_LENGTH rather than cutting mid-sentence at a fixed character
 * count - a citation is only useful if it reads like a real excerpt, not
 * a slice that starts or ends mid-word. A paragraph longer than
 * MAX_CHUNK_LENGTH on its own becomes its own chunk regardless (never
 * force-split it), since breaking a single paragraph would produce a
 * citation with no coherent boundary at all.
 *
 * A short trailing paragraph is never left stranded as a near-empty
 * chunk of its own: the greedy merge already absorbs it into the
 * previous group whenever that fits under the cap, at every step, not
 * just at the end - there's no separate "merge the last one specially"
 * pass needed (an earlier version had one; it turned out to be
 * unreachable dead code, since whatever it would have merged, the greedy
 * loop had already tried the identical merge and rejected it for the
 * same reason).
 *
 * Every returned chunk's `text` is exactly `source.slice(charStart,
 * charEnd)` - never a reconstructed string - so charStart/charEnd always
 * point at the real span the citation came from, whitespace and all.
 */
export function chunkText(source: string): Chunk[] {
  const paragraphs = splitIntoParagraphs(source);
  const groups: ParagraphSpan[] = [];
  let current: ParagraphSpan | null = null;

  for (const paragraph of paragraphs) {
    if (current === null) {
      current = { ...paragraph };
      continue;
    }
    const combinedLength = paragraph.charEnd - current.charStart;
    if (combinedLength <= MAX_CHUNK_LENGTH) {
      current.charEnd = paragraph.charEnd;
    } else {
      groups.push(current);
      current = { ...paragraph };
    }
  }
  if (current !== null) groups.push(current);

  return groups.map((g) => ({ text: source.slice(g.charStart, g.charEnd), charStart: g.charStart, charEnd: g.charEnd }));
}
