import { NextResponse } from "next/server";
import { getDocumentById, getWorkspaceBySlackTeamId, listUnrestrictedPassagesForWorkspace, logQuery } from "@/lib/db/queries";
import { selectAnswer } from "@/lib/retrieval/answer";
import { verifySlackRequest } from "@/lib/slack/verify";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

/**
 * A Slack slash command (e.g. "/ask how many vacation days do I get") -
 * verified against the app's signing secret before anything in the body
 * is trusted (see verify.ts), then answered with the same real
 * hybridSearch + confidence-threshold refusal every other entry point
 * uses, just scoped to workspace-wide-visible documents only (no signed-
 * in Passage user to check a restricted allowlist against).
 */
export const POST = withErrorHandling(async (request: Request) => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return NextResponse.json({ error: "Slack integration is not configured" }, { status: 503 });

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  const rawBody = await request.text();

  if (!timestamp || !signature || !verifySlackRequest(signingSecret, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "invalid request signature" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const teamId = params.get("team_id");
  const text = params.get("text")?.trim();

  if (!teamId) return NextResponse.json({ response_type: "ephemeral", text: "Missing team_id." });
  if (!text) return NextResponse.json({ response_type: "ephemeral", text: "Ask a question after the command, like `/ask how many vacation days do I get?`" });

  const workspace = await getWorkspaceBySlackTeamId(teamId);
  if (!workspace) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "This Slack workspace isn't connected to a Passage workspace yet - an owner needs to connect it first.",
    });
  }

  const passages = await listUnrestrictedPassagesForWorkspace(workspace.id);
  const result = selectAnswer(passages.map((p) => ({ id: p.id, text: p.text })), text);

  await logQuery({
    workspaceId: workspace.id,
    userId: null,
    questionText: text,
    answeredPassageId: result.passageId,
    confidence: result.confidence,
    refused: result.refused,
  }).catch((err) => console.error("failed to log Slack query", err)); // best-effort - a logging failure shouldn't block answering the actual question

  if (result.refused) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Nothing in this workspace's documents answers that with enough confidence to cite.",
    });
  }

  const passage = passages.find((p) => p.id === result.passageId);
  const document = passage ? await getDocumentById(passage.documentId) : null;

  return NextResponse.json({
    response_type: "ephemeral",
    text: `> ${passage?.text ?? ""}\n\n— from *${document?.title ?? "a document"}*`,
  });
});
