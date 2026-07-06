import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { verifyVideoDuration } from "@/lib/volcengine";

const DOUYIN_HOSTS = ["douyin.com", "iesdouyin.com"];
const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|mkv|avi|flv|wmv|ts)(?:$|[?#])/i;

export type ResolvedVideo = {
  videoUrl: string;
  durationSeconds: number;
  sourceName: string;
  sourceType: "direct" | "douyin";
};

export function extractSharedUrl(input: string) {
  const match = input.match(/https?:\/\/[^\s<>"'，。]+/i);
  if (!match) throw new Error("没有识别到有效的 HTTP/HTTPS 链接");
  return match[0].replace(/[)\]】]+$/, "");
}

function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value === "0:0:0:0:0:0:0:1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  const ipv4 = value.startsWith("::ffff:") ? value.slice(7) : value;
  const parts = ipv4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

export async function assertPublicUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("仅支持公网 HTTP/HTTPS 视频链接");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".localhost")) throw new Error("不支持本地或内网地址");
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("不支持本地或内网地址");
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("该地址无法安全访问");
  }
  return url;
}

async function fetchPublicPage(initialUrl: string) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        // 抖音分享页会对桌面 UA 返回反爬脚本；移动端分享页会返回可解析的 SSR 数据。
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,video/*;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9"
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("链接跳转缺少目标地址");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`链接访问失败（${response.status}）`);
    }
    return { response, finalUrl: current };
  }
  throw new Error("链接跳转次数过多");
}

async function readTextLimited(response: Response, maxBytes = 5_000_000) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new Error("链接页面内容过大，无法安全解析");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("链接页面内容过大，无法安全解析");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function isDouyinUrl(rawUrl: string) {
  const hostname = new URL(rawUrl).hostname.toLowerCase();
  return DOUYIN_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function durationSeconds(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed > 21_600 ? parsed / 1000 : parsed;
}

function decodeUrl(value: string) {
  return value.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

function collectUrls(value: unknown, output: string[]) {
  if (typeof value === "string" && /^https?:/i.test(decodeUrl(value))) output.push(decodeUrl(value));
  else if (Array.isArray(value)) value.forEach((item) => collectUrls(item, output));
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url_list", "urlList", "src", "url"]) if (key in record) collectUrls(record[key], output);
  }
}

function parseJsonCandidates(html: string) {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    let text = match[1].trim();
    if (!text || text.length > 5_000_000) continue;
    try {
      if (text.startsWith("%7B") || text.startsWith("%5B")) text = decodeURIComponent(text);
      // 新版移动端作品页使用 window._ROUTER_DATA = {...} 注入 SSR 数据。
      text = text.replace(/^window\._ROUTER_DATA\s*=\s*/, "").replace(/;\s*$/, "");
      values.push(JSON.parse(text));
    } catch { /* 页面中多数 script 不是 JSON */ }
  }
  return values;
}

function extractDouyinData(html: string) {
  let best: { duration: number; videoUrl?: string; title?: string; score: number } | null = null;
  const seen = new WeakSet<object>();
  let visited = 0;

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || visited++ > 40_000 || seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) return node.forEach(visit);
    const value = node as Record<string, unknown>;
    const video = value.video && typeof value.video === "object" ? value.video as Record<string, unknown> : null;
    const duration = durationSeconds(video?.duration ?? value.video_duration ?? value.duration);
    if (duration) {
      const urls: string[] = [];
      for (const candidate of [video?.play_addr, video?.playAddr, video?.download_addr, value.play_addr, value.playAddr]) collectUrls(candidate, urls);
      const videoUrl = urls.find((url) => /^https?:/i.test(url));
      const title = typeof value.desc === "string" ? value.desc : typeof value.title === "string" ? value.title : undefined;
      const score = (videoUrl ? 10 : 0) + (video ? 3 : 0) + (title ? 1 : 0);
      if (!best || score > best.score) best = { duration, videoUrl, title, score };
    }
    Object.values(value).forEach(visit);
  };
  parseJsonCandidates(html).forEach(visit);

  if (!best) {
    const match = html.match(/["'](?:video_duration|duration)["']\s*:\s*["']?(\d+(?:\.\d+)?)/i);
    const duration = durationSeconds(match?.[1]);
    if (duration) best = { duration, score: 0 };
  }
  if (best && !best.videoUrl) {
    const urls = [...html.matchAll(/https?:\\?\/\\?\/[^"'\s<>]+/gi)].map((item) => decodeUrl(item[0]));
    best.videoUrl = urls.find((url) => /(?:play|video|\.mp4)/i.test(url));
  }
  return best;
}

export async function resolveVideoSource(input: string): Promise<ResolvedVideo> {
  const sharedUrl = extractSharedUrl(input);
  const { response, finalUrl } = await fetchPublicPage(sharedUrl);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const direct = contentType.startsWith("video/") || VIDEO_EXTENSIONS.test(finalUrl);

  if (direct) {
    await response.body?.cancel();
    const duration = await verifyVideoDuration(finalUrl, `resolve-${randomUUID()}`);
    return { videoUrl: finalUrl, durationSeconds: duration, sourceName: new URL(finalUrl).pathname.split("/").pop() || "网络视频", sourceType: "direct" };
  }

  if (!isDouyinUrl(finalUrl) && !isDouyinUrl(sharedUrl)) {
    await response.body?.cancel();
    throw new Error("该链接不是可直接处理的视频，请提供视频文件直链或抖音分享链接");
  }
  const html = await readTextLimited(response);
  const data = extractDouyinData(html);
  if (!data?.videoUrl) throw new Error("暂时无法解析该抖音链接，请确认作品公开，或改用视频文件直链");
  await assertPublicUrl(data.videoUrl);
  const duration = data.duration || await verifyVideoDuration(data.videoUrl, `resolve-${randomUUID()}`);
  return {
    videoUrl: data.videoUrl,
    durationSeconds: duration,
    sourceName: data.title?.slice(0, 180) || "抖音视频",
    sourceType: "douyin"
  };
}
