import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { getDocumentById, insertPassages, setDocumentStatus } from "@/lib/db/queries";

function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? "./uploads";
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
    const text = await extractText(buffer, document.contentType);
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
