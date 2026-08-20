import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createDocument, getDocumentById, getWorkspaceForMember, listDocumentsForWorkspace } from "@/lib/db/queries";
import { InvalidUploadError, saveUploadedDocument } from "@/lib/storage";
import { ingestDocument } from "@/lib/ingestion/pipeline";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  const documents = await listDocumentsForWorkspace(resolved.workspace.id);
  return NextResponse.json({ documents });
});

export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const titleField = formData.get("title");
  const title = typeof titleField === "string" && titleField.trim().length > 0 ? titleField.trim() : file.name;

  let saved;
  try {
    saved = await saveUploadedDocument(file);
  } catch (err) {
    if (err instanceof InvalidUploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const document = await createDocument({
    workspaceId: resolved.workspace.id,
    title,
    sourceFilename: file.name,
    contentType: file.type,
    fileSizeBytes: file.size,
    storageUrl: saved.url,
    uploadedByUserId: session.userId,
  });

  // Ingestion (extract + chunk + index) runs before this responds -
  // small enough documents that a synchronous round trip is fine, and it
  // means the client's very next "list documents" call already sees an
  // accurate status instead of a "processing" that silently never
  // updates without a separate poll-and-refresh mechanism.
  await ingestDocument(document.id);
  const ingested = await getDocumentById(document.id);

  return NextResponse.json({ document: ingested }, { status: 201 });
});
