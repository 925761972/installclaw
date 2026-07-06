import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requestUploadIntent } from "@/lib/volcengine";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const data = await requestUploadIntent();
    return NextResponse.json(data.result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "获取上传地址失败" }, { status: 502 });
  }
}
