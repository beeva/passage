import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// A real DB round-trip (select 1), not just "the process is up" - a load
// balancer or orchestrator routing traffic to an instance that can't
// reach Postgres should see this fail, the same way any other request
// would.
export const GET = withErrorHandling(async () => {
  await db.execute(sql`select 1`);
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
});
