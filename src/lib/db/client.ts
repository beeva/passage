import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __passageQueryClient: ReturnType<typeof postgres> | undefined;
  var __passageDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function getQueryClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Reuse the connection pool across hot reloads in dev instead of opening
  // a fresh one per module reload.
  if (!globalThis.__passageQueryClient) {
    globalThis.__passageQueryClient = postgres(connectionString);
  }
  return globalThis.__passageQueryClient;
}

// Connecting lazily, on first use, rather than at module load - a module
// that exports both DB-backed functions and plain pure ones shouldn't
// require DATABASE_URL just because a unit test imports only the pure
// half (the retrieval scoring functions are like this).
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (!globalThis.__passageDb) {
      globalThis.__passageDb = drizzle(getQueryClient(), { schema });
    }
    return Reflect.get(globalThis.__passageDb, prop, receiver);
  },
});
