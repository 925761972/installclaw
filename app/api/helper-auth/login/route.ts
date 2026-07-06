import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth";
import { createHelperAccessToken } from "@/lib/helper-auth";
import { db } from "@/lib/db";
import { corsHeaders, corsOptions } from "@/lib/cors";

const schema = z.object({ email: z.string().email(), password: z.string().min(1), deviceId: z.string().min(6).max(120) });
export function OPTIONS(request: Request) { return corsOptions(request); }

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "邮箱或密码格式不正确" }, { status: 400, headers });
  const user = db.prepare("SELECT id, email, password_hash, password_salt FROM users WHERE email = ?")
    .get(parsed.data.email.toLowerCase()) as { id: string; email: string; password_hash: string; password_salt: string } | undefined;
  if (!user || !verifyPassword(parsed.data.password, user.password_salt, user.password_hash)) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401, headers });
  }
  const token = createHelperAccessToken(user.id, parsed.data.deviceId);
  return NextResponse.json({ token, user: { id: user.id, email: user.email } }, { headers });
}
