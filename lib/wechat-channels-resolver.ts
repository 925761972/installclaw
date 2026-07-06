const YUANBAO_PARSE_URL = "https://yuanbao.tencent.com/api/weixin/get_parse_result";
const CHANNELS_FEED_URL = "https://channels.weixin.qq.com/finder-preview/api/feed/get_feed_info";

type ParseResult = { code?: number; msg?: string; data?: { playable_url?: string; wx_export_id?: string } };
type FeedResult = {
  errCode?: number;
  errMsg?: string;
  data?: {
    authorInfo?: { nickname?: string };
    feedInfo?: {
      description?: string;
      videoUrl?: string;
      originVideoUrl?: string;
      h264VideoInfo?: { videoUrl?: string };
      h265VideoInfo?: { videoUrl?: string };
    };
  };
};

function requiredCookie() {
  const cookie = process.env.WECHAT_CHANNELS_YUANBAO_COOKIE?.trim();
  if (!cookie) throw new Error("视频号解析通道尚未配置，请配置 WECHAT_CHANNELS_YUANBAO_COOKIE，或改为上传本地视频");
  return cookie;
}

function cleanMediaUrl(raw: string) {
  const url = new URL(raw);
  const encfilekey = url.searchParams.get("encfilekey");
  const token = url.searchParams.get("token");
  if (!encfilekey || !token) return raw;
  url.search = new URLSearchParams({ encfilekey, token }).toString();
  return url.toString();
}

export function isWechatChannelsUrl(raw: string) {
  const host = new URL(raw).hostname.toLowerCase();
  return host === "weixin.qq.com" || host.endsWith(".weixin.qq.com") ||
    host === "channels.weixin.qq.com" || host.endsWith(".channels.weixin.qq.com");
}

export async function resolveWechatChannels(sharedUrl: string) {
  const parseResponse = await fetch(YUANBAO_PARSE_URL, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: "https://yuanbao.tencent.com",
      Referer: "https://yuanbao.tencent.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
      Cookie: requiredCookie()
    },
    body: JSON.stringify({ type: "video_channel_url", url: sharedUrl, scene: 1 })
  });
  if (!parseResponse.ok) {
    if (parseResponse.status === 401 || parseResponse.status === 403) throw new Error("视频号解析登录态已失效，请更新元宝 Cookie");
    throw new Error(`视频号链接解析服务暂时不可用（${parseResponse.status}）`);
  }
  const parsed = await parseResponse.json() as ParseResult;
  if (parsed.code && parsed.code !== 0) throw new Error(parsed.msg || "视频号分享链接解析失败");

  const playableUrl = parsed.data?.playable_url ? new URL(parsed.data.playable_url) : null;
  const exportId = playableUrl?.searchParams.get("eid") || parsed.data?.wx_export_id;
  const generalToken = playableUrl?.searchParams.get("token");
  if (!exportId || !generalToken) throw new Error("该视频号链接没有返回可播放凭证，请确认作品仍然公开");

  const rid = `${Math.floor(Date.now() / 1000).toString(16)}-${crypto.randomUUID().slice(0, 8)}`;
  const referer = new URL("https://channels.weixin.qq.com/finder-preview/pages/feed");
  referer.search = new URLSearchParams({ entry_card_type: "48", comment_scene: "39", appid: "0", token: generalToken, entry_scene: "0", eid: exportId }).toString();
  const feedResponse = await fetch(`${CHANNELS_FEED_URL}?_rid=${encodeURIComponent(rid)}&_pageUrl=https:%2F%2Fchannels.weixin.qq.com%2Ffinder-preview%2Fpages%2Ffeed`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: "https://channels.weixin.qq.com",
      Referer: referer.toString(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36"
    },
    body: JSON.stringify({ baseReq: { generalToken }, exportId })
  });
  if (!feedResponse.ok) throw new Error(`视频号作品信息获取失败（${feedResponse.status}）`);
  const feed = await feedResponse.json() as FeedResult;
  if (feed.errCode && feed.errCode !== 0) throw new Error(feed.errMsg || "视频号作品信息获取失败");
  const info = feed.data?.feedInfo;
  const rawVideoUrl = info?.originVideoUrl || info?.videoUrl || info?.h264VideoInfo?.videoUrl || info?.h265VideoInfo?.videoUrl;
  if (!rawVideoUrl) throw new Error("该视频号作品没有返回可处理的视频地址");
  return { videoUrl: cleanMediaUrl(rawVideoUrl), sourceName: info?.description?.slice(0, 180) || feed.data?.authorInfo?.nickname || "视频号视频" };
}
