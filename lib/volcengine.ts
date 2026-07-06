const BASE_URL = "https://mediakit.cn-beijing.volces.com/api/v1";

function apiKey() {
  const key = process.env.VOLCENGINE_MEDIAKIT_API_KEY;
  if (!key) throw new Error("尚未配置 VOLCENGINE_MEDIAKIT_API_KEY");
  return key;
}

async function volcFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error?.message || `火山引擎请求失败（${response.status}）`);
  }
  return data;
}

function readPositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function metadataDurationSeconds(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const value = result as Record<string, unknown>;
  const formatMeta = value.format_meta && typeof value.format_meta === "object"
    ? value.format_meta as Record<string, unknown>
    : null;
  const videoMeta = value.video_stream_meta && typeof value.video_stream_meta === "object" && !Array.isArray(value.video_stream_meta)
    ? value.video_stream_meta as Record<string, unknown>
    : null;

  for (const candidate of [
    value.duration_seconds,
    value.duration_sec,
    value.duration,
    formatMeta?.duration_seconds,
    formatMeta?.duration,
    videoMeta?.duration_seconds,
    videoMeta?.duration
  ]) {
    const seconds = readPositiveNumber(candidate);
    if (seconds) return seconds;
  }

  for (const candidate of [value.duration_ms, formatMeta?.duration_ms, videoMeta?.duration_ms]) {
    const milliseconds = readPositiveNumber(candidate);
    if (milliseconds) return milliseconds / 1000;
  }
  return null;
}

export async function requestUploadIntent() {
  return volcFetch("/tools-sync/request-media-upload-url", { method: "POST", body: "{}" });
}

export function buildMediaKitRef(fileId: string) {
  return fileId.startsWith("mediakit://") ? fileId : `mediakit://${fileId}`;
}

export async function uploadBinaryToMediaKit(
  body: Blob,
  contentType: string,
  deps: {
    requestUploadIntent?: typeof requestUploadIntent;
    fetchImpl?: typeof fetch;
  } = {}
) {
  const requestIntent = deps.requestUploadIntent ?? requestUploadIntent;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const intent = await requestIntent();
  const uploadUrl = intent?.result?.upload_url;
  const fileId = intent?.result?.file_id;

  if (!uploadUrl || !fileId) throw new Error("获取上传地址失败");

  const response = await fetchImpl(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body
  });

  if (!response.ok) throw new Error(`上传中转文件失败（${response.status}）`);

  return { fileId, videoRef: buildMediaKitRef(fileId) };
}

export type SubmitOptions = {
  mode: "standard" | "pro";
  videoRef: string;
  clientToken: string;
  eraseMode?: "Subtitle" | "Text";
  encodeMode?: "Quality" | "Size";
  regions?: Array<{ top_left_x: number; top_left_y: number; bottom_right_x: number; bottom_right_y: number }>;
};

export async function submitEraseJob(options: SubmitOptions) {
  const endpoint = options.mode === "pro" ? "/tools/erase-video-subtitle-pro" : "/tools/erase-video-subtitle";
  const body: Record<string, unknown> = {
    video_url: options.videoRef,
    client_token: options.clientToken
  };
  if (options.mode === "pro") {
    body.mode = options.eraseMode ?? "Subtitle";
    body.output_encode_mode = options.encodeMode ?? "Quality";
    if (options.regions?.length) body.erase_ratio_location = options.regions;
  }
  return volcFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
}

export async function verifyVideoDuration(videoRef: string, clientToken: string) {
  const accepted = await volcFetch("/tools/probe-video-metadata", {
    method: "POST",
    body: JSON.stringify({ video_url: videoRef, client_token: clientToken })
  });
  if (!accepted.task_id) throw new Error("视频时长校验任务创建失败");

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const task = await volcFetch(`/tasks/${encodeURIComponent(accepted.task_id)}`);
    if (task.status === "completed") {
      const duration = metadataDurationSeconds(task.result);
      if (!duration) throw new Error("未能从视频元信息中读取真实时长");
      return duration;
    }
    if (task.status === "failed") throw new Error(task.error?.message || "视频时长校验失败");
  }
  throw new Error("视频时长校验超时，请稍后重试");
}

export async function queryEraseJob(taskId: string) {
  return volcFetch(`/tasks/${encodeURIComponent(taskId)}`);
}
