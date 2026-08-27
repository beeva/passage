import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceBySlackTeamId, getWorkspaceForMember, setWorkspaceSlackTeamId } from "@/lib/db/queries";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({ slackTeamId: z.string().trim().min(1).max(50) });

export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only a workspace owner can connect Slack" }, { status: 403 });
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

  const existing = await getWorkspaceBySlackTeamId(parsed.data.slackTeamId);
  if (existing && existing.id !== resolved.workspace.id) {
    return NextResponse.json({ error: "this Slack workspace is already connected to a different Passage workspace" }, { status: 409 });
  }

  await setWorkspaceSlackTeamId(resolved.workspace.id, parsed.data.slackTeamId);
  return NextResponse.json({ slackTeamId: parsed.data.slackTeamId });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only a workspace owner can disconnect Slack" }, { status: 403 });
  }

  await setWorkspaceSlackTeamId(resolved.workspace.id, null);
  return NextResponse.json({ ok: true });
});
