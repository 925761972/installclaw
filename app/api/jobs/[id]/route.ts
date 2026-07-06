import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usagePoints, type EraseMode } from "@/lib/pricing";
import { queryEraseJob } from "@/lib/volcengine";

type JobRow = {
  id: string; user_id: string; mode: EraseMode; status: string; reserved_points: number;
  final_points: number | null; provider_task_id: string | null; result_url: string | null;
  provider_error: string | null; duration_estimate_sec: number;
};

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  let job = db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(id, user.id) as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (!job.provider_task_id || !["running", "submitting"].includes(job.status)) return NextResponse.json(job);

  try {
    const remote = await queryEraseJob(job.provider_task_id);
    if (remote.status === "completed") {
      const remoteDuration = Number(remote.result?.duration);
      const outputPoints = usagePoints(Number.isFinite(remoteDuration) && remoteDuration > 0 ? remoteDuration : job.duration_estimate_sec, job.mode);
      // 提交时按服务端核验的真实时长足额冻结；完结时只可能退款，绝不再补扣。
      const charged = Math.min(job.reserved_points, outputPoints);
      const adjustment = job.reserved_points - charged;
      db.transaction(() => {
        const updated = db.prepare(`UPDATE jobs SET status = 'completed', result_url = ?, final_points = ?, updated_at = ? WHERE id = ? AND status = 'running'`)
          .run(remote.result?.video_url ?? null, charged, Date.now(), job!.id);
        if (updated.changes === 1 && adjustment !== 0) {
          db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(adjustment, user.id);
          db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, reference_id, note, created_at)
                      VALUES (?, ?, 'settlement', ?, ?, ?, ?)`)
            .run(randomUUID(), user.id, adjustment, job!.id, adjustment > 0 ? "按实际时长退回积分" : "按实际时长补扣积分", Date.now());
        }
      })();
    } else if (remote.status === "failed") {
      const message = remote.error?.message || "处理失败";
      db.transaction(() => {
        const updated = db.prepare("UPDATE jobs SET status = 'failed', provider_error = ?, updated_at = ? WHERE id = ? AND status = 'running'")
          .run(message, Date.now(), job!.id);
        if (updated.changes === 1) {
          db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(job!.reserved_points, user.id);
          db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, reference_id, note, created_at)
                      VALUES (?, ?, 'refund', ?, ?, '任务失败，退回预留积分', ?)`)
            .run(randomUUID(), user.id, job!.reserved_points, job!.id, Date.now());
        }
      })();
    }
    job = db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(id, user.id) as JobRow;
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ ...job, pollError: error instanceof Error ? error.message : "状态查询失败" });
  }
}
