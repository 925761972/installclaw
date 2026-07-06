import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "mock")) {
    return NextResponse.json({ error: "模拟支付仅可在开发环境使用" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "订单号无效" }, { status: 400 });
  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(parsed.data.orderId, user.id) as
    | { id: string; status: string; points: number; amount_cents: number }
    | undefined;
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  if (order.status === "paid") return NextResponse.json({ ok: true, points: order.points });
  db.transaction(() => {
    const changed = db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'")
      .run(Date.now(), order.id).changes;
    if (!changed) throw new Error("订单状态异常");
    db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(order.points, user.id);
    db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, amount_cents, reference_id, note, created_at)
                VALUES (?, ?, 'recharge', ?, ?, ?, '套餐充值到账', ?)`)
      .run(randomUUID(), user.id, order.points, order.amount_cents, order.id, Date.now());
  })();
  return NextResponse.json({ ok: true, points: order.points });
}
