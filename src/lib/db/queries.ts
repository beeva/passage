import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { documentAccess, documents, passages, queries, users, workspaceMembers, workspaces } from "./schema";
import type { DocumentStatus } from "./schema";

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function createUser(email: string, passwordHash: string) {
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  if (!user) throw new Error("failed to create user");
  return user;
}

export async function createWorkspace(slug: string, name: string) {
  const [workspace] = await db.insert(workspaces).values({ slug, name }).returning();
  if (!workspace) throw new Error("failed to create workspace");
  return workspace;
}

export async function getWorkspaceBySlug(slug: string) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return workspace ?? null;
}

export async function getWorkspaceBySlackTeamId(slackTeamId: string) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slackTeamId, slackTeamId)).limit(1);
  return workspace ?? null;
}

export async function setWorkspaceSlackTeamId(workspaceId: number, slackTeamId: string | null) {
  await db.update(workspaces).set({ slackTeamId }).where(eq(workspaces.id, workspaceId));
}

/** null if either the workspace doesn't exist or the user isn't a member - callers treat both the same way (404, not a distinct 403), so a workspace's existence isn't leaked to someone who can't see it. */
export async function getWorkspaceForMember(slug: string, userId: number) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return null;
  const membership = await getMembership(workspace.id, userId);
  if (!membership) return null;
  return { workspace, membership };
}

export async function addWorkspaceMember(workspaceId: number, userId: number, role: "owner" | "member") {
  const [member] = await db.insert(workspaceMembers).values({ workspaceId, userId, role }).returning();
  if (!member) throw new Error("failed to add workspace member");
  return member;
}

/** null if the user isn't a member of this workspace at all - the caller treats that the same as "not found," not a distinct 403, so a workspace's existence isn't leaked to someone who can't see it. */
export async function getMembership(workspaceId: number, userId: number) {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return member ?? null;
}

export async function listWorkspacesForUser(userId: number) {
  return db
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, createdAt: workspaces.createdAt, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
}

export async function listWorkspaceMembers(workspaceId: number) {
  return db
    .select({ id: workspaceMembers.id, userId: users.id, email: users.email, role: workspaceMembers.role, createdAt: workspaceMembers.createdAt })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function createDocument(input: {
  workspaceId: number;
  title: string;
  sourceFilename: string;
  contentType: string;
  fileSizeBytes: number;
  storageUrl: string;
  uploadedByUserId: number;
}) {
  const [document] = await db.insert(documents).values({ ...input, status: "processing" }).returning();
  if (!document) throw new Error("failed to create document");
  return document;
}

export async function setDocumentStatus(documentId: number, status: DocumentStatus, errorMessage?: string) {
  await db.update(documents).set({ status, errorMessage: errorMessage ?? null }).where(eq(documents.id, documentId));
}

export async function getDocumentById(documentId: number) {
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return document ?? null;
}

export async function getDocumentByStorageUrl(storageUrl: string) {
  const [document] = await db.select().from(documents).where(eq(documents.storageUrl, storageUrl)).limit(1);
  return document ?? null;
}

export async function listDocumentsForWorkspace(workspaceId: number) {
  return db.select().from(documents).where(eq(documents.workspaceId, workspaceId)).orderBy(documents.createdAt);
}

export async function deleteDocument(documentId: number) {
  const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning({ storageUrl: documents.storageUrl });
  return deleted ?? null;
}

export async function setDocumentAccess(documentId: number, userIds: number[]) {
  await db.delete(documentAccess).where(eq(documentAccess.documentId, documentId));
  if (userIds.length > 0) {
    await db.insert(documentAccess).values(userIds.map((userId) => ({ documentId, userId })));
  }
}

export async function listDocumentAccessUserIds(documentId: number): Promise<number[]> {
  const rows = await db.select({ userId: documentAccess.userId }).from(documentAccess).where(eq(documentAccess.documentId, documentId));
  return rows.map((r) => r.userId);
}

/**
 * Two gates, both required: the user must be a member of the document's
 * own workspace at all (a document id from workspace A means nothing to
 * a member of workspace B, guessed or not), and if the document is
 * further restricted (document_access has rows), the user must be on
 * that allowlist. A document with no document_access rows is visible to
 * every workspace member - the default, not an edge case. This is the
 * single source of truth for "can this user see this document," used by
 * both the document-serving route and the passage retrieval that backs
 * every query, so a restricted document can never leak through either
 * path.
 */
export async function canUserAccessDocument(userId: number, documentId: number): Promise<boolean> {
  const document = await getDocumentById(documentId);
  if (!document) return false;

  const membership = await getMembership(document.workspaceId, userId);
  if (!membership) return false;

  const restrictedTo = await listDocumentAccessUserIds(documentId);
  if (restrictedTo.length === 0) return true;
  return restrictedTo.includes(userId);
}

export async function insertPassages(
  documentId: number,
  workspaceId: number,
  chunks: { text: string; charStart: number; charEnd: number; ordinal: number }[]
) {
  if (chunks.length === 0) return;
  await db.insert(passages).values(chunks.map((c) => ({ documentId, workspaceId, ...c })));
}

export async function getPassageById(passageId: number) {
  const [passage] = await db.select().from(passages).where(eq(passages.id, passageId)).limit(1);
  return passage ?? null;
}

/**
 * Every document a user is allowed to see, in one workspace: readable
 * (status "ready" - a still-processing or failed upload has no usable
 * passages yet) and either workspace-wide-visible or explicitly
 * allowlisted for this user. Computed as a set difference (all ready
 * docs, minus the ones restricted away from this user) rather than a
 * single join, since "a document with no access rows is visible to
 * everyone" doesn't translate cleanly into one SQL predicate without a
 * NOT EXISTS subquery per document - this is the same logic, just done
 * as three simple queries.
 */
async function filterVisibleDocumentIds(candidateDocIds: number[], userId: number): Promise<number[]> {
  if (candidateDocIds.length === 0) return [];

  const restrictedRows = await db.select({ documentId: documentAccess.documentId }).from(documentAccess).where(inArray(documentAccess.documentId, candidateDocIds));
  const restrictedDocIds = new Set(restrictedRows.map((r) => r.documentId));

  const allowedRows = await db
    .select({ documentId: documentAccess.documentId })
    .from(documentAccess)
    .where(and(inArray(documentAccess.documentId, candidateDocIds), eq(documentAccess.userId, userId)));
  const allowedDocIds = new Set(allowedRows.map((r) => r.documentId));

  return candidateDocIds.filter((id) => !restrictedDocIds.has(id) || allowedDocIds.has(id));
}

export async function listVisibleDocumentIds(workspaceId: number, userId: number): Promise<number[]> {
  const readyDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspaceId), eq(documents.status, "ready")));
  return filterVisibleDocumentIds(readyDocs.map((d) => d.id), userId);
}

/** Every passage this user is allowed to see in this workspace - what a query's retrieval actually searches over. */
export async function listVisiblePassagesForWorkspace(workspaceId: number, userId: number) {
  const visibleDocIds = await listVisibleDocumentIds(workspaceId, userId);
  if (visibleDocIds.length === 0) return [];
  return db.select().from(passages).where(inArray(passages.documentId, visibleDocIds));
}

/**
 * The permission-aware counterpart to listDocumentsForWorkspace - every
 * status (processing/ready/failed), not just "ready" (listVisibleDocumentIds
 * deliberately excludes non-ready documents, since only a ready document
 * has passages worth searching, but a user still needs to see their own
 * in-progress or failed uploads listed). A restricted document is
 * invisible here exactly the same way it's invisible to retrieval and the
 * file-serving route - title, size, and status were leaking through the
 * unfiltered listing before this existed.
 */
export async function listVisibleDocumentsForWorkspace(workspaceId: number, userId: number) {
  const allDocs = await db.select().from(documents).where(eq(documents.workspaceId, workspaceId)).orderBy(documents.createdAt);
  const visibleIds = new Set(await filterVisibleDocumentIds(allDocs.map((d) => d.id), userId));
  return allDocs.filter((d) => visibleIds.has(d.id));
}

/**
 * The Slack slash command path has no Passage user behind it - Slack
 * only proves which team and channel a request came from, not which
 * individual Passage account (there's no OAuth identity-linking flow
 * here) - so it can only ever search documents that are visible to the
 * whole workspace, never anything restricted to a specific allowlist.
 * That's a real, narrower corpus than a signed-in user gets, not a
 * shortcut around the permission model.
 */
export async function listUnrestrictedPassagesForWorkspace(workspaceId: number) {
  const readyDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspaceId), eq(documents.status, "ready")));
  const docIds = readyDocs.map((d) => d.id);
  if (docIds.length === 0) return [];

  const restrictedRows = await db.select({ documentId: documentAccess.documentId }).from(documentAccess).where(inArray(documentAccess.documentId, docIds));
  const restrictedDocIds = new Set(restrictedRows.map((r) => r.documentId));

  const unrestrictedDocIds = docIds.filter((id) => !restrictedDocIds.has(id));
  if (unrestrictedDocIds.length === 0) return [];
  return db.select().from(passages).where(inArray(passages.documentId, unrestrictedDocIds));
}

export async function logQuery(input: {
  workspaceId: number;
  userId: number | null;
  questionText: string;
  answeredPassageId: number | null;
  confidence: number;
  refused: boolean;
}) {
  const [query] = await db.insert(queries).values(input).returning();
  if (!query) throw new Error("failed to log query");
  return query;
}

export async function listQueriesForWorkspace(workspaceId: number, limit = 50) {
  return db.select().from(queries).where(eq(queries.workspaceId, workspaceId)).orderBy(desc(queries.createdAt)).limit(limit);
}
