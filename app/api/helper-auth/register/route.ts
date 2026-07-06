import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/auth";
import { createHelperAccessToken } from "@/lib/helper-auth";
import { corsHeaders, corsOptions } from "@/lib/cors";

const schema = z.object({
  email: z.string().email("请输入有效邮箱").max(120),
  password: z.string().min(8, "密码至少 8 位").max(128),
  deviceId: z.string().min(6).max(120)
});

export function OPTIONS(request: Request) { return corsOptions(request); }

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400, headers });
  try {
    const userId = createUser(parsed.data.email, parsed.data.password);
    const token = createHelperAccessToken(userId, parsed.data.deviceId);
    return NextResponse.json({ token, user: { id: userId, email: parsed.data.email.toLowerCase() } }, { headers });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "该邮箱已注册，请直接登录" : "注册失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 409, headers });
  }
}
