import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { users, workspaceMembers, workspaces } from "./schema";

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
