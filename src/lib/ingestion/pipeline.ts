import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { getDocumentById, insertPassages, setDocumentStatus } from "@/lib/db/queries";

function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? "./uploads";
}

const EXTRACTION_TIMEOUT_MS = 30_000;

/**
 * Bounds real wall-clock time on the slow, user-controlled-input step of
 * ingestion (PDF/DOCX parsing) - a pathologically constructed file
 * shouldn't be able to hang this route forever. This is a genuinely
 * partial mitigation, not a complete one: Node is single-threaded, so a
 * timer-based race can only fire once the event loop gets a chance to run
 * it - a decompression routine that blocks synchronously for its entire
 * duration (rather than yielding at multiple async steps) isn't actually
 * preempted by this. A memory ceiling and a real timeout both require
 * running extraction in an isolated worker/process, which this doesn't
 * do. Documented here rather than silently assumed solved.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  // Clears the timer once the real promise settles either way - Promise.race
  // doesn't cancel the loser on its own, so without this a fast extraction
  // would still leave a dangling 30s timer running for every single upload.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs after a document row already exists (status "processing") and its
 * file is already saved to disk - extracts real text, chunks it, and
 * writes the resulting passages, then flips status to "ready" or
 * "failed". Split from the upload route itself so ingestion can be
 * retried or run out-of-band without re-uploading the file.
 */
export async function ingestDocument(documentId: number): Promise<void> {
  const document = await getDocumentById(documentId);
  if (!document) throw new Error(`document ${documentId} not found`);

  try {
    const filename = document.storageUrl.replace(/^\/uploads\//, "");
    const buffer = await readFile(path.join(uploadsDir(), filename));
    const text = await withTimeout(extractText(buffer, document.contentType), EXTRACTION_TIMEOUT_MS, "extraction took too long");
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await setDocumentStatus(documentId, "failed", "no extractable text found in this document");
      return;
    }

    await insertPassages(
      document.id,
      document.workspaceId,
      chunks.map((chunk, index) => ({ ...chunk, ordinal: index }))
    );
    await setDocumentStatus(documentId, "ready");
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingestion failed";
    await setDocumentStatus(documentId, "failed", message);
  }
}
