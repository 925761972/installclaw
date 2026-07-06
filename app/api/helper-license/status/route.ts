import { NextResponse } from "next/server";
import { z } from "zod";
import { getHelperUser } from "@/lib/helper-auth";
import { getHelperLicenseStatus } from "@/lib/helper-license";
import { corsHeaders, corsOptions } from "@/lib/cors";

const schema = z.object({ deviceId: z.string().min(6).max(120) });
export function OPTIONS(request: Request) { return corsOptions(request); }
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const user = getHelperUser(request);
  if (!user) return NextResponse.json({ error: "请先登录视频号助手账号" }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "设备信息不完整" }, { status: 400, headers });
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    license: getHelperLicenseStatus(user.id, parsed.data.deviceId)
  }, { headers });
}
