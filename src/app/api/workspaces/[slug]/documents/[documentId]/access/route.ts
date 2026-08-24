import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  getDocumentById,
  getWorkspaceForMember,
  listDocumentAccessUserIds,
  listWorkspaceMembers,
  setDocumentAccess,
} from "@/lib/db/queries";
import type { Document } from "@/lib/db/schema";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

type ResolvedDocument =
  | { error: NextResponse }
  | { resolved: NonNullable<Awaited<ReturnType<typeof getWorkspaceForMember>>>; document: Document };

async function resolveDocument(slug: string, documentId: string, userId: number): Promise<ResolvedDocument> {
  const resolved = await getWorkspaceForMember(slug, userId);
  if (!resolved) return { error: NextResponse.json({ error: "workspace not found" }, { status: 404 }) };

  const id = Number(documentId);
  if (!Number.isInteger(id)) return { error: NextResponse.json({ error: "invalid document id" }, { status: 400 }) };

  const document = await getDocumentById(id);
  if (!document || document.workspaceId !== resolved.workspace.id) {
    return { error: NextResponse.json({ error: "document not found" }, { status: 404 }) };
  }

  return { resolved, document };
}

export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ slug: string; documentId: string }> }) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { slug, documentId } = await params;
    const result = await resolveDocument(slug, documentId, session.userId);
    if ("error" in result) return result.error;

    const userIds = await listDocumentAccessUserIds(result.document.id);
    return NextResponse.json({ restricted: userIds.length > 0, userIds });
  }
);

const bodySchema = z.object({ userIds: z.array(z.number().int().positive()) });

// An empty userIds array means "unrestricted, visible to the whole
// workspace again" - the same default document_access rows convey
// everywhere else (see the comment on that table in schema.ts) - not a
// separate "clear restriction" endpoint.
export const PUT = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ slug: string; documentId: string }> }) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { slug, documentId } = await params;
    const result = await resolveDocument(slug, documentId, session.userId);
    if ("error" in result) return result.error;

    if (result.resolved.membership.role !== "owner") {
      return NextResponse.json({ error: "only a workspace owner can change document access" }, { status: 403 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
    }

    // Every id in the allowlist must actually be a member of this
    // workspace - restricting a document "to" someone who isn't even in
    // the workspace would just make it invisible to everyone.
    const members = await listWorkspaceMembers(result.resolved.workspace.id);
    const memberIds = new Set(members.map((m) => m.userId));
    const invalid = parsed.data.userIds.filter((id) => !memberIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `not a member of this workspace: ${invalid.join(", ")}` }, { status: 400 });
    }

    await setDocumentAccess(result.document.id, parsed.data.userIds);
    return NextResponse.json({ restricted: parsed.data.userIds.length > 0, userIds: parsed.data.userIds });
  }
);
