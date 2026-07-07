import { NextResponse } from "next/server";
import { z } from "zod";
import { sendVerificationCode, canSendCode } from "@/lib/email";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email("请输入有效邮箱").max(120)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const email = parsed.data.email.toLowerCase();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
  if (existing) return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });

  const canSend = canSendCode(email);
  if (!canSend.ok) {
    return NextResponse.json({ error: canSend.error, waitSeconds: canSend.waitSeconds }, { status: 429 });
  }

  const result = await sendVerificationCode(email);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({
    ok: true,
    devMode: result.devMode,
    devCode: result.devCode
  });
}
