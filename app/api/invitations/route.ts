import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function ensureInviteCode(userId: string): string {
  const row = db.prepare("SELECT invite_code FROM users WHERE id = ?").get(userId) as { invite_code: string | null } | undefined;
  if (row?.invite_code) return row.invite_code;
  
  // 老用户没有邀请码，自动生成一个
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const exists = db.prepare("SELECT id FROM users WHERE invite_code = ?").get(code);
    if (!exists) {
      db.prepare("UPDATE users SET invite_code = ? WHERE id = ?").run(code, userId);
      return code;
    }
  }
  const fallback = generateCode() + randomUUID().slice(0, 2).toUpperCase();
  db.prepare("UPDATE users SET invite_code = ? WHERE id = ?").run(fallback, userId);
  return fallback;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const inviteCode = ensureInviteCode(user.id);
  
  const invitedCount = db.prepare(`
    SELECT COUNT(*) as count FROM invitations WHERE inviter_id = ?
  `).get(user.id) as { count: number };
  
  const totalRewards = db.prepare(`
    SELECT COALESCE(SUM(points), 0) as total FROM point_transactions 
    WHERE user_id = ? AND type = 'invite_reward'
  `).get(user.id) as { total: number };

  const recentInvites = db.prepare(`
    SELECT i.created_at, i.reward_points, u.email
    FROM invitations i
    LEFT JOIN users u ON u.id = i.invitee_id
    WHERE i.inviter_id = ?
    ORDER BY i.created_at DESC
    LIMIT 10
  `).all(user.id) as Array<{ created_at: number; reward_points: number; email: string | null }>;

  const appUrl = process.env.PUBLIC_APP_URL || "https://zaolang.ltd";

  return NextResponse.json({
    inviteCode,
    inviteLink: `${appUrl}/register?invite=${inviteCode}`,
    invitedCount: invitedCount.count,
    totalRewards: totalRewards.total,
    recentInvites: recentInvites.map((invite) => ({
      email: invite.email ? invite.email.slice(0, 3) + "****" + invite.email.slice(invite.email.indexOf("@")) : "待注册",
      points: invite.reward_points,
      time: new Date(invite.created_at).toLocaleDateString("zh-CN")
    }))
  });
}
