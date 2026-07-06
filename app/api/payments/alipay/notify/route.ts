import { NextResponse } from "next/server";
import { handleAlipayNotify } from "@/lib/payments/service";

export async function POST(request: Request) {
  try {
    await handleAlipayNotify(request);
    return new NextResponse("success");
  } catch {
    return new NextResponse("failure", { status: 400 });
  }
}
