import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { registerResolvedVideo } from "@/lib/resolved-video-cache";
import { resolveVideoSource } from "@/lib/video-resolver";
import { registerVideoPreview } from "@/lib/video-preview";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ url: z.string().min(8).max(4000) });
const recentRequests = new Map<string, number[]>();

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请输入有效的视频或抖音分享链接" }, { status: 400 });

  const now = Date.now();
  const timestamps = (recentRequests.get(user.id) ?? []).filter((time) => now - time < 60_000);
  if (timestamps.length >= 10) return NextResponse.json({ error: "解析过于频繁，请一分钟后再试" }, { status: 429 });
  timestamps.push(now);
  recentRequests.set(user.id, timestamps);

  try {
    const resolved = await resolveVideoSource(parsed.data.url);
    const previewToken = registerVideoPreview(user.id, resolved.videoUrl);
    const resolvedToken = registerResolvedVideo({
      userId: user.id,
      videoUrl: resolved.videoUrl,
      durationSeconds: resolved.durationSeconds,
      sourceName: resolved.sourceName,
      sourceType: resolved.sourceType
    });
    return NextResponse.json({ ...resolved, resolvedToken, previewUrl: `/api/video/preview/${previewToken}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "视频链接解析失败" }, { status: 422 });
  }
}
