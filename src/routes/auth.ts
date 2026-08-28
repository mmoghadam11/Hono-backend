import { Hono } from "hono";
import { sign } from "hono/jwt";
import bcrypt from "bcryptjs";
import { getDb } from "../db/client";
import { refreshTokens, users } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types/hono";

const auth = new Hono<AppEnv>();
async function issueTokens(c: any, userId: string, username: string) {
  const db = getDb(c.env);

  // access token کوتاه‌عمر (۱۵ دقیقه)
  const accessToken = await sign(
    {
      sub: userId,
      username,
      exp: Math.floor(Date.now() / 1000) + 60 * 15,
    },
    c.env.JWT_SECRET,
    "HS256"
  );

  // refresh token طولانی‌عمر (۳۰ روز) - یه رشته‌ی تصادفی ساده، نه JWT
  const refreshTokenValue = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    userId,
    token: refreshTokenValue,
    expiresAt,
    createdAt: new Date(),
  });

  return { accessToken, refreshToken: refreshTokenValue };
}
// ---------- ثبت‌نام ----------
auth.post("/signup", async (c) => {
  const body = await c.req.json();
  const { username, password, firstName, lastName, nationalCode, mobileNumber } = body;

  if (!username || !password || !nationalCode) {
    return c.json({ message: "اطلاعات ناقص است" }, 400);
  }

  const db = getDb(c.env);

  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.username, username), eq(users.nationalCode, nationalCode)))
    .get();

  if (existing) {
    return c.json({ message: "کاربر با این مشخصات قبلاً ثبت شده" }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    username,
    passwordHash,
    firstName,
    lastName,
    nationalCode,
    mobileNumber,
    createdAt: new Date(),
  });

  return c.json({ message: "ثبت‌نام موفق" }, 201);
});

// ---------- لاگین ----------
auth.post("/login", async (c) => {
  const { username, password } = await c.req.json();
  const db = getDb(c.env);

  const user = await db.select().from(users).where(eq(users.username, username)).get();

  if (!user) {
    return c.json({ message: "نام کاربری یا رمز عبور اشتباه است" }, 401);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return c.json({ message: "نام کاربری یا رمز عبور اشتباه است" }, 401);
  }

  const { accessToken, refreshToken } = await issueTokens(c, user.id, user.username);
  const { passwordHash, ...userInfo } = user;

  return c.json({ accessToken, refreshToken, userInfo });
});
// ---------- رفرش توکن ----------
auth.post("/refresh", async (c) => {
  const { refreshToken } = await c.req.json();

  if (!refreshToken) {
    return c.json({ message: "توکن ارسال نشده" }, 400);
  }

  const db = getDb(c.env);

  const stored = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken))
    .get();

  if (!stored || stored.expiresAt < new Date()) {
    return c.json({ message: "توکن نامعتبر یا منقضی‌شده است" }, 401);
  }

  const user = await db.select().from(users).where(eq(users.id, stored.userId)).get();
  if (!user) {
    return c.json({ message: "کاربر یافت نشد" }, 404);
  }

  // توکن قدیمی رو حذف می‌کنیم (rotation - هر refresh یه توکن جدید می‌سازه)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  const { accessToken, refreshToken: newRefreshToken } = await issueTokens(
    c,
    user.id,
    user.username
  );

  return c.json({ accessToken, refreshToken: newRefreshToken });
});
// ---------- logout ----------
auth.post("/logout", requireAuth, async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}));
  const db = getDb(c.env);

  if (refreshToken) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }

  return c.json({ message: "خروج موفق" });
});
// ---------- ویرایش پروفایل ----------
auth.patch("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { firstName, lastName, mobileNumber } = body;

  const db = getDb(c.env);

  const existing = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!existing) {
    return c.json({ message: "کاربر یافت نشد" }, 404);
  }

  await db
    .update(users)
    .set({
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(mobileNumber && { mobileNumber }),
    })
    .where(eq(users.id, userId));

  const updated = await db.select().from(users).where(eq(users.id, userId)).get();
  const { passwordHash, ...userInfo } = updated!;

  return c.json({ message: "بروزرسانی موفق", userInfo });
});

export default auth;