import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getDocumentById, getPassageById, getWorkspaceForMember, listVisiblePassagesForWorkspace, logQuery } from "@/lib/db/queries";
import { selectAnswer } from "@/lib/retrieval/answer";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(500),
});

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  const limitResult = rateLimit(`query:${session.userId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limitResult.allowed) return NextResponse.json({ error: "too many questions, try again in a minute" }, { status: 429 });

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

  // The search corpus is exactly what this user is allowed to see, not
  // "every passage in the workspace filtered afterward" - a restricted
  // document's passages never even enter the ranking, so there's no
  // window where a low-confidence match against something the user can't
  // see could accidentally get exposed by a scoring quirk.
  const visiblePassages = await listVisiblePassagesForWorkspace(resolved.workspace.id, session.userId);
  const result = selectAnswer(
    visiblePassages.map((p) => ({ id: p.id, text: p.text })),
    parsed.data.question
  );

  await logQuery({
    workspaceId: resolved.workspace.id,
    userId: session.userId,
    questionText: parsed.data.question,
    answeredPassageId: result.passageId,
    confidence: result.confidence,
    refused: result.refused,
  });

  if (result.refused) {
    return NextResponse.json({ refused: true, confidence: result.confidence });
  }

  const passage = await getPassageById(result.passageId);
  if (!passage) return NextResponse.json({ refused: true, confidence: result.confidence });

  const document = await getDocumentById(passage.documentId);

  return NextResponse.json({
    refused: false,
    confidence: result.confidence,
    passage: { id: passage.id, text: passage.text, pageNumber: passage.pageNumber },
    document: document ? { id: document.id, title: document.title, storageUrl: document.storageUrl } : null,
  });
});
