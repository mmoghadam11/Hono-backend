import { drizzle } from "drizzle-orm/d1";

export function getDb(env: { hono_backend_db: D1Database }) {
  return drizzle(env.hono_backend_db);
}