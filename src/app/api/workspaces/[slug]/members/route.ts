import { NextResponse } from "next/server";
import { z } from "zod";
import { addWorkspaceMember, getMembership, getUserByEmail, getWorkspaceForMember, listWorkspaceMembers } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const ADD_MEMBER_RATE_LIMIT = 20;
const ADD_MEMBER_RATE_WINDOW_MS = 60 * 60_000;

export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  const members = await listWorkspaceMembers(resolved.workspace.id);
  return NextResponse.json({ members });
});

const bodySchema = z.object({ email: z.string().trim().email() });

// Adds an EXISTING account as a member - there's no invite-by-email flow
// here (no email to send one through), so someone has to have already
// signed up before they can be added to a workspace. A real product
// would send an invite; this is the honest, smaller version of that.
export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only a workspace owner can add members" }, { status: 403 });
  }

  const limitResult = rateLimit(`add-member:${session.userId}`, ADD_MEMBER_RATE_LIMIT, ADD_MEMBER_RATE_WINDOW_MS);
  if (!limitResult.allowed) return NextResponse.json({ error: "too many requests, try again later" }, { status: 429 });

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

  const user = await getUserByEmail(parsed.data.email.toLowerCase());
  if (!user) return NextResponse.json({ error: "no account with this email exists yet" }, { status: 404 });

  const existing = await getMembership(resolved.workspace.id, user.id);
  if (existing) return NextResponse.json({ error: "already a member of this workspace" }, { status: 409 });

  const member = await addWorkspaceMember(resolved.workspace.id, user.id, "member");
  return NextResponse.json({ member: { ...member, email: user.email } }, { status: 201 });
});
