import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createCheckout } from "@/lib/payments/service";

const schema = z.object({ packageId: z.string().min(1).max(30) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "充值套餐不存在" }, { status: 400 });

  try {
    const provider = (process.env.PAYMENT_PROVIDER || "alipay") as "alipay";
    const paymentMethod = (process.env.PAYMENT_METHOD || "alipay_web") as "alipay_web" | "alipay_qr";
    const result = await createCheckout({
      userId: user.id,
      packageId: parsed.data.packageId,
      provider,
      paymentMethod
    });
    return NextResponse.json(result);
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "订单创建失败" },
      { status: 400 }
    );
  }
}
