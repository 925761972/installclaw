import { NextResponse } from "next/server";
import { z } from "zod";
import { getHelperUser } from "@/lib/helper-auth";
import { db } from "@/lib/db";
import { addMonths, getHelperPlan } from "@/lib/helper-license";
import { corsHeaders, corsOptions } from "@/lib/cors";

const schema = z.object({ planId: z.string().min(1).max(40) });
export function OPTIONS(request: Request) { return corsOptions(request); }
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "生产环境请接入真实支付回调" }, { status: 403, headers });
  const user = getHelperUser(request);
  if (!user) return NextResponse.json({ error: "请先登录视频号助手账号" }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const plan = parsed.success ? getHelperPlan(parsed.data.planId) : undefined;
  if (!plan) return NextResponse.json({ error: "会员套餐不存在" }, { status: 400, headers });
  const now = Date.now();
  const existing = db.prepare("SELECT expires_at FROM helper_memberships WHERE user_id = ?").get(user.id) as { expires_at: number } | undefined;
  const expiresAt = addMonths(existing && existing.expires_at > now ? existing.expires_at : now, plan.months);
  db.prepare("INSERT INTO helper_memberships (user_id,plan_id,status,starts_at,expires_at,updated_at) VALUES (?,?, 'active',?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',expires_at=excluded.expires_at,updated_at=excluded.updated_at")
    .run(user.id, plan.id, now, expiresAt, now);
  return NextResponse.json({ ok: true, plan, expiresAt }, { headers });
}
