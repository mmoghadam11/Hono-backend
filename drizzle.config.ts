import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

function getLocalD1DB() {
  const basePath = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const files = fs.readdirSync(basePath).filter((f) => f.endsWith(".sqlite"));
  if (files.length === 0) {
    throw new Error("دیتابیس لوکال پیدا نشد — اول wrangler dev یا migrations apply را اجرا کنید");
  }
  return path.join(basePath, files[0]);
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: getLocalD1DB(),
  },
});