import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, workspaceMembers, workspaces } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const DEMO_EMAIL = "demo@passage.local";
const DEMO_PASSWORD = "demo-password-1234";
const DEMO_WORKSPACE_SLUG = "demo";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Idempotent by the fields that are actually unique (users.email,
  // workspaces.slug) rather than a plain insert, so re-running this
  // script against an already-seeded database is safe.
  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!user) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    [user] = await db.insert(users).values({ email: DEMO_EMAIL, passwordHash }).returning();
  }
  if (!user) throw new Error("failed to seed demo user");

  let [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, DEMO_WORKSPACE_SLUG)).limit(1);
  if (!workspace) {
    [workspace] = await db.insert(workspaces).values({ slug: DEMO_WORKSPACE_SLUG, name: "Demo Workspace" }).returning();
  }
  if (!workspace) throw new Error("failed to seed demo workspace");

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspace.id))
    .limit(1);
  if (!membership) {
    await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
  }

  console.log(`seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`workspace: /${DEMO_WORKSPACE_SLUG}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
