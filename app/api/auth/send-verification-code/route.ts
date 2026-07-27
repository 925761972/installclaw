import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sendVerificationCode } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "请输入邮箱地址" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 检查邮箱是否已注册
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const now = Date.now();

    // 检查 30 秒内是否已发送过
    const recent = db.prepare(`
      SELECT created_at FROM email_verification_codes
      WHERE email = ? AND created_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizedEmail, now - 30_000) as { created_at: number } | undefined;

    if (recent) {
      const remaining = Math.ceil((recent.created_at + 30_000 - now) / 1000);
      return NextResponse.json({ error: `请 ${remaining} 秒后再试` }, { status: 429 });
    }

    // 检查当天发送次数（最多 5 次）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const count = db.prepare(`
      SELECT COUNT(*) as cnt FROM email_verification_codes
      WHERE email = ? AND created_at > ?
    `).get(normalizedEmail, todayStart.getTime()) as { cnt: number };

    if (count.cnt >= 5) {
      return NextResponse.json({ error: "今日发送次数已达上限，请明天再试" }, { status: 429 });
    }

    // 生成 6 位数字验证码
    const code = randomInt(100000, 999999).toString();
    const expiresAt = now + 5 * 60_000; // 5 分钟有效

    db.prepare(`
      INSERT INTO email_verification_codes (email, code, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(normalizedEmail, code, expiresAt, now);

    await sendVerificationCode(normalizedEmail, code);

    return NextResponse.json({ message: "验证码已发送" });
  } catch {
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
}