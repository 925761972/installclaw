import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, createUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email("请输入有效邮箱").max(120),
  password: z.string().min(8, "密码至少 8 位").max(128),
  inviteCode: z.string().max(12).optional(),
  verificationCode: z.string().length(6, "验证码为 6 位数字")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { email, password, inviteCode, verificationCode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();

  // 验证邮箱验证码
  const record = db.prepare(`
    SELECT id FROM email_verification_codes
    WHERE email = ? AND code = ? AND expires_at > ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(normalizedEmail, verificationCode, now) as { id: number } | undefined;

  if (!record) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  try {
    const id = createUser(normalizedEmail, password, inviteCode);

    // 标记验证码已使用
    db.prepare("UPDATE email_verification_codes SET used_at = ? WHERE id = ?").run(now, record.id);

    await createSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "该邮箱已注册" : "注册失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
