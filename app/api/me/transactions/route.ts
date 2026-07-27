import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const transactions = db.prepare(`
    SELECT id, type, points, amount_cents, note, created_at
    FROM point_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(user.id);

  const orders = db.prepare(`
    SELECT id, package_id, amount_cents, points, status, created_at, paid_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(user.id);

  return NextResponse.json({ transactions, orders });
}
