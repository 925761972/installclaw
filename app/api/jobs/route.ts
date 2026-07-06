import { NextResponse } from "next/server.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ingestDouyinVideo } from "../../../lib/douyin-ingest.ts";

export const maxDuration = 60;

class InsufficientPointsError extends Error {
  balance: number;
  requiredPoints: number;
  verifiedDurationSeconds?: number;

  constructor(balance: number, requiredPoints: number, verifiedDurationSeconds?: number) {
    super(`积分不足，还差 ${Math.max(0, requiredPoints - balance)} 积分，请先充值`);
    this.balance = balance;
    this.requiredPoints = requiredPoints;
    this.verifiedDurationSeconds = verifiedDurationSeconds;
  }
}

function insufficientResponse(error: InsufficientPointsError) {
  return NextResponse.json({
    code: "INSUFFICIENT_POINTS",
    error: error.message,
    balance: error.balance,
    requiredPoints: error.requiredPoints,
    shortage: Math.max(0, error.requiredPoints - error.balance),
    verifiedDurationSeconds: error.verifiedDurationSeconds
  }, { status: 402 });
}

const regionSchema = z.object({
  top_left_x: z.number().min(0).max(1),
  top_left_y: z.number().min(0).max(1),
  bottom_right_x: z.number().min(0).max(1),
  bottom_right_y: z.number().min(0).max(1)
}).refine((v) => v.top_left_x < v.bottom_right_x && v.top_left_y < v.bottom_right_y, "擦除区域坐标无效");

const schema = z.object({
  videoRef: z.string().min(8).max(4000).refine((v) => /^(https?:\/\/|mediakit:\/\/)/.test(v), "视频地址格式不正确"),
  sourceName: z.string().min(1).max(180),
  durationSeconds: z.number().positive().max(60 * 60 * 6),
  resolvedToken: z.string().min(16).max(120).optional(),
  mode: z.enum(["standard", "pro"]),
  eraseMode: z.enum(["Subtitle", "Text"]).optional(),
  encodeMode: z.enum(["Quality", "Size"]).optional(),
  regions: z.array(regionSchema).max(20, "最多支持 20 个擦除选区").optional()
}).superRefine((value, context) => {
  if (value.mode !== "pro" && value.regions?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "只有精细化版支持指定擦除选区", path: ["regions"] });
  }
});

type SubmissionResolvedVideo = {
  videoUrl: string;
  sourceType: "direct" | "douyin";
  sourceName?: string;
} | null;

async function resolveSubmissionVideoRef(
  input: {
    inputVideoRef: string;
    resolvedVideo: SubmissionResolvedVideo;
  },
  deps: {
    ingestDouyinVideo?: typeof ingestDouyinVideo;
  } = {}
) {
  const runIngest = deps.ingestDouyinVideo ?? ingestDouyinVideo;

  if (!input.resolvedVideo || input.resolvedVideo.sourceType !== "douyin") {
    return input.inputVideoRef;
  }

  const ingested = await runIngest({
    sourceUrl: input.resolvedVideo.videoUrl,
    sourceName: input.resolvedVideo.sourceName ?? "douyin-video.mp4"
  });

  return ingested.videoRef;
}

export async function POST(request: Request) {
  const [
    { getCurrentUser },
    { db },
    { reservePoints },
    { getResolvedVideo },
    { submitEraseJob, verifyVideoDuration }
  ] = await Promise.all([
    import("../../../lib/auth.ts"),
    import("../../../lib/db.ts"),
    import("../../../lib/pricing.ts"),
    import("../../../lib/resolved-video-cache.ts"),
    import("../../../lib/volcengine.ts")
  ]);
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const input = parsed.data;
  const id = randomUUID();
  const now = Date.now();
  const options = { eraseMode: input.eraseMode, encodeMode: input.encodeMode, regions: input.regions };
  const resolvedVideo = /^https?:\/\//.test(input.videoRef) && input.resolvedToken
    ? getResolvedVideo(input.resolvedToken, user.id, input.videoRef)
    : null;
  const sourceName = resolvedVideo?.sourceName ?? input.sourceName;

  // 浏览器上报的时长可被篡改；必须由服务端从视频元信息中重新读取。
  let verifiedDurationSeconds: number;
  if (resolvedVideo) {
    verifiedDurationSeconds = resolvedVideo.durationSeconds;
  } else {
    try {
      verifiedDurationSeconds = await verifyVideoDuration(input.videoRef, `duration-${id}`);
    } catch (error) {
      return NextResponse.json({
        code: "DURATION_VERIFICATION_FAILED",
        error: error instanceof Error ? error.message : "视频真实时长校验失败，请稍后重试"
      }, { status: 422 });
    }
  }
  if (verifiedDurationSeconds > 60 * 60 * 6) {
    return NextResponse.json({ error: "视频时长超过 6 小时，暂不支持处理" }, { status: 422 });
  }
  const held = reservePoints(verifiedDurationSeconds, input.mode);

  try {
    db.transaction(() => {
      const fresh = db.prepare("SELECT points_balance FROM users WHERE id = ?").get(user.id) as { points_balance: number };
      if (fresh.points_balance < held) throw new InsufficientPointsError(fresh.points_balance, held, verifiedDurationSeconds);
      db.prepare("UPDATE users SET points_balance = points_balance - ? WHERE id = ?").run(held, user.id);
      db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, reference_id, note, created_at)
                  VALUES (?, ?, 'reserve', ?, ?, ?, ?)`)
        .run(randomUUID(), user.id, -held, id, `预留 ${input.mode === "pro" ? "精细化" : "标准版"}擦除积分`, now);
    })();
  } catch (error) {
    if (error instanceof InsufficientPointsError) return insufficientResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "积分预留失败" }, { status: 400 });
  }

  try {
    const finalVideoRef = await resolveSubmissionVideoRef({
      inputVideoRef: input.videoRef,
      resolvedVideo: resolvedVideo
        ? {
            videoUrl: resolvedVideo.videoUrl,
            sourceType: resolvedVideo.sourceType,
            sourceName: resolvedVideo.sourceName
          }
        : null
    });
    db.prepare(`
      INSERT INTO jobs (id, user_id, source_name, video_ref, duration_estimate_sec, mode, options_json,
        reserved_points, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitting', ?, ?)
    `).run(id, user.id, sourceName, finalVideoRef, verifiedDurationSeconds, input.mode, JSON.stringify(options), held, now, now);
    const data = await submitEraseJob({
      mode: input.mode,
      videoRef: finalVideoRef,
      clientToken: id,
      eraseMode: input.eraseMode,
      encodeMode: input.encodeMode,
      regions: input.regions
    });
    db.prepare("UPDATE jobs SET provider_task_id = ?, status = 'running', updated_at = ? WHERE id = ?")
      .run(data.task_id, Date.now(), id);
    return NextResponse.json({ id, status: "running", reservedPoints: held, verifiedDurationSeconds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务提交失败";
    db.transaction(() => {
      db.prepare("UPDATE jobs SET status = 'submit_failed', provider_error = ?, updated_at = ? WHERE id = ?")
        .run(message, Date.now(), id);
      db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(held, user.id);
      db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, reference_id, note, created_at)
                  VALUES (?, ?, 'refund', ?, ?, '任务提交失败，退回预留积分', ?)`)
        .run(randomUUID(), user.id, held, id, Date.now());
    })();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

(POST as typeof POST & { resolveSubmissionVideoRef: typeof resolveSubmissionVideoRef }).resolveSubmissionVideoRef = resolveSubmissionVideoRef;
