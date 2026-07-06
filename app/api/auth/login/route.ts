import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "邮箱或密码格式不正确" }, { status: 400 });
  const user = db.prepare("SELECT id, password_hash, password_salt FROM users WHERE email = ?")
    .get(parsed.data.email.toLowerCase()) as { id: string; password_hash: string; password_salt: string } | undefined;
  if (!user || !verifyPassword(parsed.data.password, user.password_salt, user.password_hash)) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
