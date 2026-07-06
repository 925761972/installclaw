import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getHelperUser } from "@/lib/helper-auth";
import { db } from "@/lib/db";
import { getHelperLicenseStatus } from "@/lib/helper-license";
import { corsHeaders, corsOptions } from "@/lib/cors";

const schema = z.object({ deviceId: z.string().min(6).max(120), videoCount: z.number().int().min(1).max(50).default(1) });
export function OPTIONS(request: Request) { return corsOptions(request); }
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const user = getHelperUser(request);
  if (!user) return NextResponse.json({ error: "请先登录视频号助手账号" }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "下载参数不完整" }, { status: 400, headers });
  const { deviceId, videoCount } = parsed.data;
  const status = getHelperLicenseStatus(user.id, deviceId);
  if (status.isMember) {
    db.prepare("INSERT INTO helper_download_events (id,user_id,device_id,video_count,event_type,created_at) VALUES (?,?,?,?, 'member_download', ?)")
      .run(randomUUID(), user.id, deviceId, videoCount, Date.now());
    return NextResponse.json({ allowed: true, license: getHelperLicenseStatus(user.id, deviceId) }, { headers });
  }
  if (status.trialRemaining < videoCount) {
    return NextResponse.json({ allowed: false, error: `免费体验剩余 ${status.trialRemaining} 条，本次需要 ${videoCount} 条，请开通会员后继续下载。`, license: status }, { status: 402, headers });
  }
  const now = Date.now();
  db.transaction(() => {
    db.prepare("INSERT INTO helper_trial_usage (user_id,device_id,used_count,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,device_id) DO UPDATE SET used_count=used_count+excluded.used_count,updated_at=excluded.updated_at")
      .run(user.id, deviceId, videoCount, now);
    db.prepare("INSERT INTO helper_download_events (id,user_id,device_id,video_count,event_type,created_at) VALUES (?,?,?,?, 'trial_download', ?)")
      .run(randomUUID(), user.id, deviceId, videoCount, now);
  })();
  return NextResponse.json({ allowed: true, license: getHelperLicenseStatus(user.id, deviceId) }, { headers });
}
