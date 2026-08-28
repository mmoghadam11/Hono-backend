import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { AppEnv } from "../types/hono";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ message: "احراز هویت نشده‌اید" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    c.set("userId", payload.sub as string);
    await next();
  } catch {
    return c.json({ message: "توکن نامعتبر یا منقضی‌شده" }, 401);
  }
});