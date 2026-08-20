import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteDocument, getDocumentById, getWorkspaceForMember } from "@/lib/db/queries";
import { deleteUploadedDocument } from "@/lib/storage";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ slug: string; documentId: string }> }) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { slug, documentId } = await params;
    const resolved = await getWorkspaceForMember(slug, session.userId);
    if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

    const id = Number(documentId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid document id" }, { status: 400 });

    // Confirm the document actually belongs to THIS workspace before
    // deleting - the workspace membership check above only proves the
    // caller belongs to the workspace in the URL, not that the id in the
    // URL is one of its own documents.
    const document = await getDocumentById(id);
    if (!document || document.workspaceId !== resolved.workspace.id) {
      return NextResponse.json({ error: "document not found" }, { status: 404 });
    }

    const deleted = await deleteDocument(id);
    if (deleted) await deleteUploadedDocument(deleted.storageUrl);

    return NextResponse.json({ ok: true });
  }
);
