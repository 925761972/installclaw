import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateUniqueInviteCode(): string {
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode();
    const exists = db.prepare("SELECT id FROM users WHERE invite_code = ?").get(code);
    if (!exists) return code;
  }
  return generateInviteCode() + randomBytes(1).toString("hex").toUpperCase();
}

const COOKIE_NAME = "subtitle_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = { id: string; email: string; points_balance: number; invite_code?: string; created_at: number };

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
    SELECT u.id, u.email, u.points_balance, u.invite_code, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), now) as SessionUser | undefined;
  return user ?? null;
}

export function createUser(email: string, password: string, inviteCode?: string) {
  const id = randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = Date.now();
  const userInviteCode = generateUniqueInviteCode();
  const welcomePoints = 20;
  const inviteRewardPoints = 100;

  db.transaction(() => {
    db.prepare("INSERT INTO users (id, email, password_hash, password_salt, points_balance, invite_code, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, email.toLowerCase(), hash, salt, welcomePoints, userInviteCode, null, now);

    if (inviteCode) {
      const normalizedCode = inviteCode.toUpperCase().trim();
      const inviter = db.prepare("SELECT id, points_balance FROM users WHERE invite_code = ?").get(normalizedCode) as { id: string; points_balance: number } | undefined;
      
      if (inviter && inviter.id !== id) {
        db.prepare("UPDATE users SET invited_by = ? WHERE id = ?").run(inviter.id, id);
        
        db.prepare(`
          INSERT INTO invitations (id, inviter_id, invitee_id, invite_code, reward_points, inviter_rewarded, invitee_rewarded, created_at, accepted_at)
          VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
        `).run(randomUUID(), inviter.id, id, normalizedCode, inviteRewardPoints, now, now);
        
        db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(inviteRewardPoints, inviter.id);
        db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(inviteRewardPoints, id);
        
        db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, reference_id, note, created_at)
                    VALUES (?, ?, 'invite_reward', ?, ?, '邀请好友奖励', ?)`)
          .run(randomUUID(), inviter.id, inviteRewardPoints, id, now);
        
        db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, reference_id, note, created_at)
                    VALUES (?, ?, 'invited_bonus', ?, ?, '被邀请注册奖励', ?)`)
          .run(randomUUID(), id, inviteRewardPoints, inviter.id, now);
      }
    }
  })();

  return id;
}
