import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "请输入注册邮箱" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail) as { id: string } | undefined;

    if (user) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const now = Date.now();
      const expiresAt = now + 1000 * 60 * 30;

      db.prepare(`
        INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(tokenHash, user.id, expiresAt, now);

      const resetUrl = `${process.env.PUBLIC_APP_URL || "https://zaolang.ltd"}/reset-password?token=${token}`;

      await sendPasswordResetEmail(normalizedEmail, resetUrl);
    }

    return NextResponse.json({
      message: "如果该邮箱已注册，重置链接已发送到您的邮箱"
    });
  } catch {
    return NextResponse.json({ error: "请求失败，请稍后重试" }, { status: 500 });
  }
}
