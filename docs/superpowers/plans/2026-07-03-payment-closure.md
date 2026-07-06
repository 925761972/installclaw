# Payment Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为套餐充值接入真实支付宝电脑网站支付，并同时预留支付宝扫码支付与微信支付 provider 扩展位，确保积分只在服务端验签回调成功后到账。

**Architecture:** 先把支付能力从现有 `mock` 流程中拆出来，建立统一的 `provider -> service -> route` 三层结构。订单模型升级后，`/api/checkout` 只负责创建订单并发起支付，积分入账统一由支付宝异步回调通过事务和幂等校验完成；前端仅展示支付宝入口，后续可通过配置从 `alipay_web` 切到 `alipay_qr`，无需重做账务闭环。

**Tech Stack:** Next.js 16、React 19、TypeScript、Node test runner、better-sqlite3、支付宝电脑网站支付、RSA2 验签、Zod

---

### Task 1: 建立支付域类型与枚举

**Files:**
- Create: `d:\TRAE\text clear\lib\payments\types.ts`
- Test: `d:\TRAE\text clear\lib\payments\types.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  isTerminalOrderStatus,
  normalizePaymentMethod,
  type PaymentMethod
} from "./payments/types.ts";

test("只允许已定义的支付方式", () => {
  assert.equal(normalizePaymentMethod("alipay_web"), "alipay_web");
  assert.equal(normalizePaymentMethod("alipay_qr"), "alipay_qr");
  assert.equal(normalizePaymentMethod("wechat_jsapi"), "wechat_jsapi");
  assert.equal(normalizePaymentMethod("unknown"), null);
});

test("paid closed failed 都视为终态", () => {
  assert.equal(isTerminalOrderStatus("paid"), true);
  assert.equal(isTerminalOrderStatus("closed"), true);
  assert.equal(isTerminalOrderStatus("failed"), true);
  assert.equal(isTerminalOrderStatus("pending"), false);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/payments/types.test.mjs`
Expected: FAIL，提示 `./payments/types.ts` 不存在或导出缺失

- [ ] **Step 3: 写最小实现**

```ts
export const PAYMENT_PROVIDERS = ["alipay", "wechat"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = [
  "alipay_web",
  "alipay_qr",
  "wechat_native",
  "wechat_jsapi"
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUSES = [
  "pending",
  "paying",
  "paid",
  "closed",
  "failed"
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function normalizePaymentMethod(value: string): PaymentMethod | null {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
}

export function isTerminalOrderStatus(status: OrderStatus) {
  return status === "paid" || status === "closed" || status === "failed";
}
```

- [ ] **Step 4: 再跑测试并确认通过**

Run: `node --test lib/payments/types.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/payments/types.ts lib/payments/types.test.mjs
git commit -m "feat: add payment domain types"
```

### Task 2: 升级订单模型与订单仓储

**Files:**
- Modify: `d:\TRAE\text clear\lib\db.ts`
- Create: `d:\TRAE\text clear\lib\payments\orders.ts`
- Test: `d:\TRAE\text clear\lib\payments\orders.test.mjs`

- [ ] **Step 1: 写失败测试，锁定订单创建与回调入账幂等行为**

```js
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  applyPaidOrder,
  createPendingOrder,
  preparePaymentDb
} from "./payments/orders.ts";

function makeDb() {
  const db = new Database(":memory:");
  preparePaymentDb(db);
  db.prepare("INSERT INTO users (id, email, password_hash, password_salt, points_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("user-1", "demo@example.com", "hash", "salt", 0, Date.now());
  return db;
}

test("创建订单时会记录 provider 和 payment_method", () => {
  const db = makeDb();
  const order = createPendingOrder(db, {
    id: "order-1",
    userId: "user-1",
    packageId: "starter",
    amountCents: 1900,
    points: 2000,
    provider: "alipay",
    paymentMethod: "alipay_web"
  });

  assert.equal(order.status, "pending");
  assert.equal(order.provider, "alipay");
  assert.equal(order.payment_method, "alipay_web");
});

test("相同订单重复回调只入账一次", () => {
  const db = makeDb();
  createPendingOrder(db, {
    id: "order-2",
    userId: "user-1",
    packageId: "starter",
    amountCents: 1900,
    points: 2000,
    provider: "alipay",
    paymentMethod: "alipay_web"
  });

  const first = applyPaidOrder(db, {
    orderId: "order-2",
    providerTradeNo: "trade-1",
    notifyPayload: "{\"trade_status\":\"TRADE_SUCCESS\"}",
    paidAt: 1700000000000
  });
  const second = applyPaidOrder(db, {
    orderId: "order-2",
    providerTradeNo: "trade-1",
    notifyPayload: "{\"trade_status\":\"TRADE_SUCCESS\"}",
    paidAt: 1700000000000
  });

  const user = db.prepare("SELECT points_balance FROM users WHERE id = ?").get("user-1");
  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(user.points_balance, 2000);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/payments/orders.test.mjs`
Expected: FAIL，提示 `preparePaymentDb` 或 `createPendingOrder` 未定义

- [ ] **Step 3: 写最小实现**

```ts
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { PaymentMethod, PaymentProvider } from "./types";

export function preparePaymentDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      points_balance INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      points INTEGER NOT NULL,
      provider TEXT,
      payment_method TEXT,
      status TEXT NOT NULL,
      provider_order_id TEXT,
      provider_trade_no TEXT,
      idempotency_key TEXT,
      notify_payload TEXT,
      fail_reason TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER,
      closed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      amount_cents INTEGER,
      reference_id TEXT,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_order_ledger ON point_transactions(reference_id, type)
      WHERE type = 'recharge';
  `);
}

export function createPendingOrder(
  db: Database.Database,
  input: {
    id: string;
    userId: string;
    packageId: string;
    amountCents: number;
    points: number;
    provider: PaymentProvider;
    paymentMethod: PaymentMethod;
  }
) {
  const now = Date.now();
  db.prepare(`INSERT INTO orders (
    id, user_id, package_id, amount_cents, points, provider, payment_method, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`).run(
    input.id,
    input.userId,
    input.packageId,
    input.amountCents,
    input.points,
    input.provider,
    input.paymentMethod,
    now
  );
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(input.id);
}

export function applyPaidOrder(
  db: Database.Database,
  input: { orderId: string; providerTradeNo: string; notifyPayload: string; paidAt: number }
) {
  return db.transaction(() => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(input.orderId) as
      | { id: string; user_id: string; status: string; points: number; amount_cents: number }
      | undefined;
    if (!order || order.status === "paid") return { applied: false };

    const changed = db.prepare(
      "UPDATE orders SET status = 'paid', provider_trade_no = ?, notify_payload = ?, paid_at = ? WHERE id = ? AND status IN ('pending','paying')"
    ).run(input.providerTradeNo, input.notifyPayload, input.paidAt, input.orderId).changes;
    if (!changed) return { applied: false };

    db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(order.points, order.user_id);
    db.prepare(`INSERT INTO point_transactions (id, user_id, type, points, amount_cents, reference_id, note, created_at)
      VALUES (?, ?, 'recharge', ?, ?, ?, '套餐充值到账', ?)`)
      .run(randomUUID(), order.user_id, order.points, order.amount_cents, order.id, input.paidAt);
    return { applied: true };
  })();
}
```

- [ ] **Step 4: 同步生产数据库 schema**

```ts
db.exec(`
  ALTER TABLE orders ADD COLUMN provider TEXT;
  ALTER TABLE orders ADD COLUMN payment_method TEXT;
  ALTER TABLE orders ADD COLUMN provider_trade_no TEXT;
  ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
  ALTER TABLE orders ADD COLUMN notify_payload TEXT;
  ALTER TABLE orders ADD COLUMN fail_reason TEXT;
  ALTER TABLE orders ADD COLUMN closed_at INTEGER;
`);
```

注：实现时需先用 `PRAGMA table_info(orders)` 判断列是否存在，再有条件执行 `ALTER TABLE`，避免重复执行报错。

- [ ] **Step 5: 再跑测试并确认通过**

Run: `node --test lib/payments/orders.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/db.ts lib/payments/orders.ts lib/payments/orders.test.mjs
git commit -m "feat: add payment order repository"
```

### Task 3: 实现支付 provider 抽象与支付宝 provider

**Files:**
- Create: `d:\TRAE\text clear\lib\payments\provider.ts`
- Create: `d:\TRAE\text clear\lib\payments\alipay.ts`
- Create: `d:\TRAE\text clear\lib\payments\wechat.ts`
- Test: `d:\TRAE\text clear\lib\payments\provider.test.mjs`

- [ ] **Step 1: 写失败测试，定义 provider 选择与微信预留行为**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getPaymentProvider } from "./payments/provider.ts";

test("alipay provider 可正常选择", () => {
  const provider = getPaymentProvider("alipay");
  assert.equal(provider.name, "alipay");
});

test("wechat provider 当前返回未启用错误", async () => {
  const provider = getPaymentProvider("wechat");
  await assert.rejects(
    () => provider.createPayment({
      orderId: "order-1",
      amountCents: 1900,
      subject: "净幕充值",
      paymentMethod: "wechat_native"
    }),
    /暂未启用微信支付/
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/payments/provider.test.mjs`
Expected: FAIL，提示 `getPaymentProvider` 未定义

- [ ] **Step 3: 写最小实现**

```ts
import type { PaymentMethod, PaymentProvider } from "./types";

export type CreatePaymentInput = {
  orderId: string;
  amountCents: number;
  subject: string;
  paymentMethod: PaymentMethod;
};

export type CreatePaymentResult =
  | { kind: "redirect"; url: string }
  | { kind: "html_form"; html: string }
  | { kind: "qr"; qrCodeUrl: string };

export type PaymentNotifyPayload = {
  orderId: string;
  providerTradeNo: string;
  amountCents: number;
  rawPayload: string;
  paidAt: number;
};

export interface PaymentProviderDriver {
  name: PaymentProvider;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseAndVerifyNotify(request: Request): Promise<PaymentNotifyPayload>;
}
```

```ts
import { createAlipayProvider } from "./alipay";
import { createWechatProvider } from "./wechat";
import type { PaymentProvider, PaymentMethod } from "./types";
import type { PaymentProviderDriver } from "./provider";

export function getPaymentProvider(provider: PaymentProvider): PaymentProviderDriver {
  if (provider === "alipay") return createAlipayProvider();
  return createWechatProvider();
}
```

```ts
import type { PaymentProviderDriver } from "./provider";

export function createWechatProvider(): PaymentProviderDriver {
  return {
    name: "wechat",
    async createPayment() {
      throw new Error("暂未启用微信支付");
    },
    async parseAndVerifyNotify() {
      throw new Error("暂未启用微信支付");
    }
  };
}
```

- [ ] **Step 4: 实现支付宝 provider**

```ts
import crypto from "node:crypto";
import type { CreatePaymentInput, CreatePaymentResult, PaymentNotifyPayload, PaymentProviderDriver } from "./provider";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function formatAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function signParams(content: string, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyParams(content: string, signature: string, publicKey: string) {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(content, "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function sortAndJoin(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function createAlipayProvider(): PaymentProviderDriver {
  return {
    name: "alipay",
    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
      const appId = getRequiredEnv("ALIPAY_APP_ID");
      const privateKey = getRequiredEnv("ALIPAY_PRIVATE_KEY");
      const returnUrl = getRequiredEnv("ALIPAY_RETURN_URL");
      const notifyUrl = getRequiredEnv("ALIPAY_NOTIFY_URL");
      const gateway = process.env.ALIPAY_GATEWAY_URL || "https://openapi.alipay.com/gateway.do";

      if (input.paymentMethod === "alipay_qr") {
        return { kind: "qr", qrCodeUrl: "" };
      }

      const bizContent = JSON.stringify({
        out_trade_no: input.orderId,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: formatAmount(input.amountCents),
        subject: input.subject
      });

      const params: Record<string, string> = {
        app_id: appId,
        method: "alipay.trade.page.pay",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        version: "1.0",
        notify_url: notifyUrl,
        return_url: returnUrl,
        biz_content: bizContent
      };

      params.sign = signParams(sortAndJoin(params), privateKey);
      const formInputs = Object.entries(params)
        .map(([key, value]) => `<input type="hidden" name="${key}" value="${String(value).replace(/"/g, "&quot;")}" />`)
        .join("");

      return {
        kind: "html_form",
        html: `<form id="alipay-submit" method="POST" action="${gateway}">${formInputs}</form><script>document.getElementById('alipay-submit').submit();</script>`
      };
    },
    async parseAndVerifyNotify(request: Request): Promise<PaymentNotifyPayload> {
      const form = await request.formData();
      const params = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
      const signature = params.sign || "";
      const publicKey = getRequiredEnv("ALIPAY_PUBLIC_KEY");
      const ok = verifyParams(sortAndJoin(params), signature, publicKey);
      if (!ok) throw new Error("支付宝回调验签失败");
      if (params.trade_status !== "TRADE_SUCCESS" && params.trade_status !== "TRADE_FINISHED") {
        throw new Error("支付宝交易未成功");
      }
      return {
        orderId: params.out_trade_no,
        providerTradeNo: params.trade_no,
        amountCents: Math.round(Number(params.total_amount || "0") * 100),
        rawPayload: JSON.stringify(params),
        paidAt: Date.now()
      };
    }
  };
}
```

- [ ] **Step 5: 再跑测试并确认通过**

Run: `node --test lib/payments/provider.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/payments/provider.ts lib/payments/alipay.ts lib/payments/wechat.ts lib/payments/provider.test.mjs
git commit -m "feat: add payment provider abstraction"
```

### Task 4: 改造 checkout 与支付宝回调闭环

**Files:**
- Modify: `d:\TRAE\text clear\app\api\checkout\route.ts`
- Create: `d:\TRAE\text clear\app\api\payments\alipay\notify\route.ts`
- Create: `d:\TRAE\text clear\lib\payments\service.ts`
- Test: `d:\TRAE\text clear\lib\payments\service.test.mjs`

- [ ] **Step 1: 写失败测试，锁定 checkout 响应结构和回调入账校验**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildCheckoutResponse, validatePaidAmount } from "./payments/service.ts";

test("电脑网站支付应返回 html_form 结果", () => {
  const response = buildCheckoutResponse({
    orderId: "order-1",
    paymentMethod: "alipay_web",
    providerResult: { kind: "html_form", html: "<form></form>" }
  });

  assert.equal(response.orderId, "order-1");
  assert.equal(response.kind, "html_form");
});

test("支付金额不一致时拒绝入账", () => {
  assert.equal(validatePaidAmount(1900, 1900), true);
  assert.equal(validatePaidAmount(1900, 2000), false);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/payments/service.test.mjs`
Expected: FAIL，提示 `buildCheckoutResponse` 未定义

- [ ] **Step 3: 写最小实现**

```ts
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { packageById } from "@/lib/pricing";
import { createPendingOrder, applyPaidOrder } from "./orders";
import { getPaymentProvider } from "./provider";
import type { PaymentMethod, PaymentProvider } from "./types";

export function validatePaidAmount(expectedAmountCents: number, paidAmountCents: number) {
  return expectedAmountCents === paidAmountCents;
}

export function buildCheckoutResponse(input: {
  orderId: string;
  paymentMethod: PaymentMethod;
  providerResult: { kind: "html_form"; html: string } | { kind: "qr"; qrCodeUrl: string } | { kind: "redirect"; url: string };
}) {
  return {
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    ...input.providerResult
  };
}

export async function createCheckout(input: {
  userId: string;
  packageId: string;
  provider: PaymentProvider;
  paymentMethod: PaymentMethod;
}) {
  const pack = packageById(input.packageId);
  if (!pack) throw new Error("充值套餐不存在");

  const orderId = randomUUID();
  createPendingOrder(db, {
    id: orderId,
    userId: input.userId,
    packageId: pack.id,
    amountCents: pack.priceYuan * 100,
    points: pack.points,
    provider: input.provider,
    paymentMethod: input.paymentMethod
  });

  db.prepare("UPDATE orders SET status = 'paying' WHERE id = ?").run(orderId);

  const provider = getPaymentProvider(input.provider);
  const providerResult = await provider.createPayment({
    orderId,
    amountCents: pack.priceYuan * 100,
    subject: `${pack.name} - 净幕积分充值`,
    paymentMethod: input.paymentMethod
  });

  return buildCheckoutResponse({ orderId, paymentMethod: input.paymentMethod, providerResult });
}

export async function handleAlipayNotify(request: Request) {
  const provider = getPaymentProvider("alipay");
  const payload = await provider.parseAndVerifyNotify(request);
  const order = db.prepare("SELECT amount_cents FROM orders WHERE id = ?").get(payload.orderId) as
    | { amount_cents: number }
    | undefined;
  if (!order) throw new Error("订单不存在");
  if (!validatePaidAmount(order.amount_cents, payload.amountCents)) throw new Error("支付金额不一致");
  return applyPaidOrder(db, {
    orderId: payload.orderId,
    providerTradeNo: payload.providerTradeNo,
    notifyPayload: payload.rawPayload,
    paidAt: payload.paidAt
  });
}
```

- [ ] **Step 4: 改造路由**

```ts
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
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "订单创建失败" }, { status: 400 });
  }
}
```

```ts
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
```

- [ ] **Step 5: 再跑测试并确认通过**

Run: `node --test lib/payments/service.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add app/api/checkout/route.ts app/api/payments/alipay/notify/route.ts lib/payments/service.ts lib/payments/service.test.mjs
git commit -m "feat: add alipay checkout and notify flow"
```

### Task 5: 更新套餐页支付交互与配置说明

**Files:**
- Modify: `d:\TRAE\text clear\components\pricing-cards.tsx`
- Modify: `d:\TRAE\text clear\.env.example`
- Modify: `d:\TRAE\text clear\README.md`

- [ ] **Step 1: 写出前端目标行为**

```tsx
async function buy(packageId: string) {
  setLoading(packageId);
  setMessage("");
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId })
  });
  const data = await response.json();
  setLoading(null);
  if (response.status === 401) return (window.location.href = "/login?next=/pricing");
  if (!response.ok) return setMessage(data.error || "订单创建失败");

  if (data.kind === "html_form") {
    document.open();
    document.write(data.html);
    document.close();
    return;
  }

  if (data.kind === "qr") {
    setPending({ orderId: data.orderId, amountYuan: data.amountYuan, points: data.points, qrCodeUrl: data.qrCodeUrl });
    return;
  }

  setMessage("暂不支持当前支付方式");
}
```

- [ ] **Step 2: 运行类型检查并确认在改完前会报旧字段错误**

Run: `npm run lint`
Expected: FAIL，`Pending` 结构或 `mock-complete` 相关代码与新响应结构不匹配

- [ ] **Step 3: 写最小实现**

```tsx
type Pending = { orderId: string; qrCodeUrl: string } | null;
```

```tsx
<button className={`button ${index === 2 ? "button-primary" : "button-outline"} button-full`} onClick={() => void buy(pack.id)} disabled={!!loading}>
  {loading === pack.id && <LoaderCircle className="spin" size={17} />}支付宝支付
</button>
```

```tsx
{pending && (
  <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="支付宝扫码支付">
    <div className="pay-modal">
      <button className="icon-button close" onClick={() => setPending(null)} aria-label="关闭"><X /></button>
      <span className="eyebrow">支付宝扫码支付</span>
      <h2>请使用支付宝扫码完成支付</h2>
      <p>当前环境已预留扫码支付能力；若配置为电脑网站支付，将直接跳转支付宝收银台。</p>
      <img src={pending.qrCodeUrl} alt="支付宝支付二维码" />
    </div>
  </div>
)}
```

```env
PAYMENT_PROVIDER=alipay
PAYMENT_METHOD=alipay_web
APP_SECRET=replace_me
PUBLIC_APP_URL=http://localhost:3000
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=http://localhost:3000/api/payments/alipay/notify
ALIPAY_RETURN_URL=http://localhost:3000/pricing
WECHAT_MCH_ID=
WECHAT_APP_ID=
WECHAT_API_V3_KEY=
WECHAT_PRIVATE_KEY=
WECHAT_CERT_SERIAL=
WECHAT_NOTIFY_URL=
```

- [ ] **Step 4: 更新 README 的支付说明**

```md
## 支付说明

- 首发前端仅展示支付宝支付入口
- `PAYMENT_METHOD=alipay_web` 时走支付宝电脑网站支付
- `PAYMENT_METHOD=alipay_qr` 时走支付宝扫码支付
- 用户积分只会在 `/api/payments/alipay/notify` 异步回调验签成功后到账
- 前端跳转成功页不代表已经入账
```

- [ ] **Step 5: 跑类型检查并确认通过**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add components/pricing-cards.tsx .env.example README.md
git commit -m "feat: update pricing flow for alipay"
```

### Task 6: 最终验证

**Files:**
- Verify: `d:\TRAE\text clear\lib\payments\types.ts`
- Verify: `d:\TRAE\text clear\lib\payments\orders.ts`
- Verify: `d:\TRAE\text clear\lib\payments\alipay.ts`
- Verify: `d:\TRAE\text clear\lib\payments\service.ts`
- Verify: `d:\TRAE\text clear\components\pricing-cards.tsx`

- [ ] **Step 1: 跑支付相关测试**

Run: `node --test lib/payments/types.test.mjs lib/payments/orders.test.mjs lib/payments/provider.test.mjs lib/payments/service.test.mjs`
Expected: PASS

- [ ] **Step 2: 跑类型检查**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: 跑生产构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 手动验收**

```text
1. 打开 /pricing
2. 点击任意套餐的“支付宝支付”
3. 当 PAYMENT_METHOD=alipay_web 时，页面应提交支付宝表单并跳转收银台
4. 支付宝异步回调命中 /api/payments/alipay/notify 后，订单状态应变为 paid
5. 用户积分余额应增加
6. 同一回调重复发送时，不应重复加积分
7. 当 PAYMENT_METHOD=alipay_qr 时，前端应展示二维码弹窗而不是 mock 支付按钮
8. 微信支付不应在页面出现
```

- [ ] **Step 5: 提交**

```bash
git add app/api/checkout/route.ts app/api/payments/alipay/notify/route.ts components/pricing-cards.tsx lib/db.ts lib/payments .env.example README.md
git commit -m "feat: complete payment closure with alipay"
```
