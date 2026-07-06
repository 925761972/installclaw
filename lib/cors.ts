const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:2025",
  "http://localhost:2025",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://installclaw.cn",
  "https://www.installclaw.cn",
  "https://channels.weixin.qq.com",
]);

function getAllowedOrigin(origin: string): string {
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (origin.endsWith(".installclaw.cn")) return origin;
  return "null";
}

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = getAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Local-Auth",
  };
}

export function corsOptions(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
