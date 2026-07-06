import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

const TOKEN_MS = 1000 * 60 * 60 * 24 * 90;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createHelperAccessToken(userId: string, deviceId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare(`
    INSERT INTO helper_access_tokens (token_hash, user_id, device_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(hashToken(token), userId, deviceId, now + TOKEN_MS, now);
  return token;
}

export function getHelperUser(request: Request): SessionUser | null {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  const user = db.prepare(`
    SELECT u.id, u.email, u.points_balance, u.created_at
    FROM helper_access_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.expires_at > ?
  `).get(hashToken(token), Date.now()) as SessionUser | undefined;
  return user ?? null;
}

export function revokeHelperToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (token) db.prepare("DELETE FROM helper_access_tokens WHERE token_hash = ?").run(hashToken(token));
}
