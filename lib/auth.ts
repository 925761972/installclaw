import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

const COOKIE_NAME = "subtitle_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = { id: string; email: string; points_balance: number; created_at: number };

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expected: string) {
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash(token), userId, now + SESSION_MS, now);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  jar.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const now = Date.now();
  const user = db.prepare(`
    SELECT u.id, u.email, u.points_balance, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), now) as SessionUser | undefined;
  return user ?? null;
}

export function createUser(email: string, password: string) {
  const id = randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = Date.now();
  const welcomePoints = 20;
  db.prepare("INSERT INTO users (id, email, password_hash, password_salt, points_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email.toLowerCase(), hash, salt, welcomePoints, now);
  return id;
}
