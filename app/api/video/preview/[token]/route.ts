import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertPublicUrl } from "@/lib/video-resolver";
import { getVideoPreview } from "@/lib/video-preview";

export const runtime = "nodejs";

async function fetchVideo(initialUrl: string, range: string | null) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36",
        Referer: "https://www.iesdouyin.com/",
        Accept: "video/*,*/*;q=0.8",
        ...(range ? { Range: range } : {})
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("视频跳转缺少目标地址");
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error("视频跳转次数过多");
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { token } = await context.params;
  const videoUrl = getVideoPreview(token, user.id);
  if (!videoUrl) return NextResponse.json({ error: "预览地址已失效，请重新解析视频" }, { status: 404 });

  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) return NextResponse.json({ error: "Range 请求格式无效" }, { status: 416 });
  try {
    const upstream = await fetchVideo(videoUrl, range);
    if (!upstream.ok && upstream.status !== 206) {
      await upstream.body?.cancel();
      return NextResponse.json({ error: `视频源访问失败（${upstream.status}）` }, { status: 502 });
    }
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "video/mp4",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes"
    });
    for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "视频预览加载失败" }, { status: 502 });
  }
}
