import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { documents, passages, users, workspaceMembers, workspaces } from "../src/lib/db/schema";
import { chunkText } from "../src/lib/ingestion/chunk";
import { selectAnswer } from "../src/lib/retrieval/answer";
import { EVAL_DOCUMENTS, EVAL_FIXTURES } from "./eval-fixtures";

const EVAL_WORKSPACE_SLUG = "evals";
const MIN_PASSING_ACCURACY = 0.8;

/**
 * Seeds a real, dedicated workspace with real documents (chunked the
 * same way a real upload is), then runs every fixture question through
 * the real retrieval pipeline (hybridSearch + selectAnswer) and checks
 * the result against what SHOULD have been cited - or, for the refusal
 * fixtures, that it correctly refused instead of guessing. This is what
 * "citation accuracy" being a real, gated number means: a change to
 * chunking, tokenization, or the confidence threshold either holds this
 * score or it doesn't, not a vibe about whether retrieval "feels" better.
 */
async function seedEvalWorkspace(): Promise<{ workspaceId: number }> {
  let [user] = await db.select().from(users).where(eq(users.email, "evals@passage.local")).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({ email: "evals@passage.local", passwordHash: "not-a-real-login:eval-user-only" }).returning();
  }
  if (!user) throw new Error("failed to seed eval user");

  let [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, EVAL_WORKSPACE_SLUG)).limit(1);
  if (!workspace) {
    [workspace] = await db.insert(workspaces).values({ slug: EVAL_WORKSPACE_SLUG, name: "Evals" }).returning();
  }
  if (!workspace) throw new Error("failed to seed eval workspace");

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspace.id))
    .limit(1);
  if (!membership) {
    await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
  }

  // Re-runnable: clear out any documents/passages from a previous run
  // before seeding fresh ones, rather than accumulating duplicates every
  // time this script runs.
  await db.delete(documents).where(eq(documents.workspaceId, workspace.id));

  for (const evalDoc of EVAL_DOCUMENTS) {
    const [document] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        title: evalDoc.title,
        sourceFilename: `${evalDoc.title.toLowerCase().replace(/\s+/g, "-")}.txt`,
        contentType: "text/plain",
        fileSizeBytes: Buffer.byteLength(evalDoc.text, "utf8"),
        storageUrl: "/uploads/eval-fixture-not-a-real-file.txt",
        status: "ready",
        uploadedByUserId: user.id,
      })
      .returning();
    if (!document) throw new Error(`failed to seed document "${evalDoc.title}"`);

    const chunks = chunkText(evalDoc.text);
    if (chunks.length > 0) {
      await db.insert(passages).values(
        chunks.map((chunk, index) => ({ documentId: document.id, workspaceId: workspace.id, ordinal: index, ...chunk }))
      );
    }
  }

  return { workspaceId: workspace.id };
}

async function main() {
  const { workspaceId } = await seedEvalWorkspace();

  const allPassages = await db.select().from(passages).where(eq(passages.workspaceId, workspaceId));
  const passagesByDocumentId = new Map<number, typeof allPassages>();
  for (const passage of allPassages) {
    const list = passagesByDocumentId.get(passage.documentId) ?? [];
    list.push(passage);
    passagesByDocumentId.set(passage.documentId, list);
  }

  const documentTitleById = new Map<number, string>();
  const allDocuments = await db.select().from(documents).where(eq(documents.workspaceId, workspaceId));
  for (const document of allDocuments) documentTitleById.set(document.id, document.title);

  const passageDocumentId = new Map<number, number>();
  for (const passage of allPassages) passageDocumentId.set(passage.id, passage.documentId);

  let correct = 0;
  const rows: { question: string; expected: string; actual: string; confidence: number; ok: boolean }[] = [];

  for (const fixture of EVAL_FIXTURES) {
    const result = selectAnswer(
      allPassages.map((p) => ({ id: p.id, text: p.text })),
      fixture.question
    );

    const expected = fixture.expectedDocumentTitle ?? "(refuse)";
    let actual: string;
    let ok: boolean;

    if (fixture.expectedDocumentTitle === undefined) {
      actual = result.refused ? "(refused)" : (documentTitleById.get(passageDocumentId.get(result.passageId!)!) ?? "(unknown doc)");
      ok = result.refused;
    } else if (result.refused) {
      actual = "(refused)";
      ok = false;
    } else {
      const documentId = passageDocumentId.get(result.passageId);
      actual = (documentId !== undefined ? documentTitleById.get(documentId) : undefined) ?? "(unknown doc)";
      ok = actual === fixture.expectedDocumentTitle;
    }

    if (ok) correct++;
    rows.push({ question: fixture.question, expected, actual, confidence: result.confidence, ok });
  }

  const accuracy = correct / EVAL_FIXTURES.length;

  console.log("");
  for (const row of rows) {
    const mark = row.ok ? "PASS" : "FAIL";
    console.log(`[${mark}] confidence=${row.confidence.toFixed(3)}  ${row.question}`);
    if (!row.ok) console.log(`       expected: ${row.expected}  got: ${row.actual}`);
  }
  console.log("");
  console.log(`citation accuracy: ${correct}/${EVAL_FIXTURES.length} (${(accuracy * 100).toFixed(1)}%)`);

  if (accuracy < MIN_PASSING_ACCURACY) {
    console.error(`FAILED - below the ${(MIN_PASSING_ACCURACY * 100).toFixed(0)}% gate`);
    process.exit(1);
  }
  console.log(`PASSED - meets the ${(MIN_PASSING_ACCURACY * 100).toFixed(0)}% gate`);
  // The postgres connection pool keeps its socket open indefinitely -
  // without an explicit exit, this script (correctly) finishes all its
  // work but then just hangs forever instead of returning control to
  // whatever ran it (a CI step, a shell prompt).
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
