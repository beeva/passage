import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_CONTENT_TYPES } from "./ingestion/extract";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB - documents, not media

export class InvalidUploadError extends Error {}

export interface SavedDocument {
  url: string;
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "text/plain": "txt",
  "text/markdown": "md",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

// Deliberately NOT under /public: Next's production build serves /public
// through a routing manifest computed at build time, so a file written
// there after the app is already deployed (every uploaded document,
// since uploads happen at runtime) silently 404s in production even
// though the identical request works in dev. The route handler at
// src/app/uploads/[filename] serves these files instead.
function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? "./uploads";
}

export async function saveUploadedDocument(file: File): Promise<SavedDocument> {
  if (!SUPPORTED_CONTENT_TYPES.includes(file.type)) {
    throw new InvalidUploadError(`unsupported document type: ${file.type || "unknown"}`);
  }
  if (file.size === 0) throw new InvalidUploadError("uploaded file is empty");
  if (file.size > MAX_FILE_SIZE_BYTES) throw new InvalidUploadError("file exceeds the 50MB limit");

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const extension = EXTENSION_BY_CONTENT_TYPE[file.type] ?? "bin";
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(dir, filename), buffer);

  return { url: `/uploads/${filename}` };
}

/** Best-effort - a missing file on disk shouldn't block deleting the document row that pointed to it. */
export async function deleteUploadedDocument(url: string): Promise<void> {
  if (!url.startsWith("/uploads/")) return;
  const filename = url.slice("/uploads/".length);
  if (!filename || filename.includes("/") || filename.includes("..")) return;
  try {
    await unlink(path.join(uploadsDir(), filename));
  } catch {
    // already gone, or never existed - either way there's nothing left to do
  }
}
