import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    if (!token || typeof token !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "无效的请求" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码长度不能少于6位" }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = Date.now();

    const resetToken = db.prepare(`
      SELECT user_id FROM password_reset_tokens
      WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL
    `).get(tokenHash, now) as { user_id: string } | undefined;

    if (!resetToken) {
      return NextResponse.json({ error: "重置链接已过期或已使用，请重新申请" }, { status: 400 });
    }

    const { hash, salt } = hashPassword(password);
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
      .run(hash, salt, resetToken.user_id);

    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?")
      .run(now, tokenHash);

    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(resetToken.user_id);

    return NextResponse.json({ message: "密码重置成功，请使用新密码登录" });
  } catch {
    return NextResponse.json({ error: "重置失败，请稍后重试" }, { status: 500 });
  }
}
