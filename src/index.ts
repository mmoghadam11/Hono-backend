import { Hono } from "hono";
import { cors } from "hono/cors";
import authRoutes from "./routes/auth";
import type { AppEnv } from "./types/hono";

const app = new Hono<{ Bindings: AppEnv }>();

app.use("*", cors({ origin: "http://localhost:3000", credentials: true }));

app.route("/auth", authRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;