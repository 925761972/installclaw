import { NextResponse } from "next/server";
import { revokeHelperToken } from "@/lib/helper-auth";
import { corsHeaders, corsOptions } from "@/lib/cors";

export function OPTIONS(request: Request) { return corsOptions(request); }
export async function POST(request: Request) {
  revokeHelperToken(request);
  return NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
}
