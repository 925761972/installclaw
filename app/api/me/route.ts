import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const jobs = db.prepare(`
    SELECT id, source_name, duration_estimate_sec, mode, reserved_points, final_points,
           status, result_url, provider_error, created_at, updated_at
    FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(user.id);
  return NextResponse.json({ user, jobs });
}
