import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canUserAccessDocument, getDocumentByStorageUrl } from "@/lib/db/queries";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const FILENAME_PATTERN = /^[a-f0-9-]+\.(txt|md|pdf|docx)$/;

function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? "./uploads";
}

/**
 * Unlike a podcast episode's audio (meant for anyone with the link),
 * source documents are private by default - this route re-checks the
 * exact same permission canUserAccessDocument enforces for retrieval, so
 * a restricted document's file can't be fetched directly just because
 * someone has (or guesses) its /uploads/ URL. Not through Next's static
 * /public handling either way - see storage.ts's uploadsDir() comment
 * for why a file written after the app is built needs a real route.
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ filename: string }> }) => {
  const { filename } = await params;
  if (!FILENAME_PATTERN.test(filename)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const storageUrl = `/uploads/${filename}`;
  const document = await getDocumentByStorageUrl(storageUrl);
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  const allowed = await canUserAccessDocument(session.userId, document.id);
  if (!allowed) return NextResponse.json({ error: "not found" }, { status: 404 });

  const extension = filename.split(".").pop() as string;
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension];
  if (!contentType) return NextResponse.json({ error: "not found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(uploadsDir(), filename));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${document.sourceFilename.replace(/"/g, "")}"`,
    },
  });
});
