import { NextResponse } from "next/server";
import { handleAlipayNotify } from "@/lib/payments/service";

export async function POST(request: Request) {
  try {
    await handleAlipayNotify(request);
    return new NextResponse("success");
  } catch (error) {
    console.error(
      "[alipay-notify] processing failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return new NextResponse("failure", { status: 400 });
  }
}
