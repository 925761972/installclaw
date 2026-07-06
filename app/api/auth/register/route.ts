import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, createUser } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("请输入有效邮箱").max(120),
  password: z.string().min(8, "密码至少 8 位").max(128)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const id = createUser(parsed.data.email, parsed.data.password);
    await createSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "该邮箱已注册" : "注册失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
