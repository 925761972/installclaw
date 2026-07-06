import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { preparePaymentDb } from "./orders.ts";
import {
  buildCheckoutResponse,
  createCheckout,
  handleAlipayNotify,
  validatePaidAmount
} from "./service.ts";

function makeDb() {
  const db = new Database(":memory:");
  preparePaymentDb(db);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, points_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("user-1", "demo@example.com", "hash", "salt", 0, Date.now());
  return db;
}

test("电脑网站支付应返回 html_form 结果", () => {
  const response = buildCheckoutResponse({
    orderId: "order-1",
    paymentMethod: "alipay_web",
    providerResult: { kind: "html_form", html: "<form></form>" }
  });

  assert.equal(response.orderId, "order-1");
  assert.equal(response.kind, "html_form");
  assert.equal(response.paymentMethod, "alipay_web");
});

test("支付金额不一致时拒绝入账", () => {
  assert.equal(validatePaidAmount(1900, 1900), true);
  assert.equal(validatePaidAmount(1900, 2000), false);
});

test("createCheckout 会创建 paying 订单并返回支付结果", async () => {
  const db = makeDb();
  const provider = {
    createPayment: async (input) => {
      assert.equal(input.amountCents, 2900);
      assert.equal(input.paymentMethod, "alipay_web");
      return { kind: "html_form", html: "<form>ok</form>" };
    }
  };

  const result = await createCheckout(
    {
      userId: "user-1",
      packageId: "starter",
      provider: "alipay",
      paymentMethod: "alipay_web"
    },
    {
      db,
      provider
    }
  );

  assert.equal(result.kind, "html_form");
  assert.equal(typeof result.orderId, "string");

  const order = db.prepare("SELECT status, amount_cents, provider, payment_method FROM orders WHERE id = ?").get(result.orderId);
  assert.equal(order.status, "paying");
  assert.equal(order.amount_cents, 2900);
  assert.equal(order.provider, "alipay");
  assert.equal(order.payment_method, "alipay_web");
});

test("handleAlipayNotify 验证金额后只入账一次", async () => {
  const db = makeDb();
  db.prepare(
    `INSERT INTO orders (
      id, user_id, package_id, amount_cents, points, provider, payment_method, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'paying', ?)`
  ).run("order-2", "user-1", "starter", 2900, 2900, "alipay", "alipay_web", Date.now());

  const request = new Request("https://example.com/api/payments/alipay/notify", { method: "POST" });
  const parseAndVerifyNotify = async () => ({
    orderId: "order-2",
    providerTradeNo: "trade-1",
    amountCents: 2900,
    rawPayload: "{\"trade_status\":\"TRADE_SUCCESS\"}",
    paidAt: 1700000000000
  });

  const first = await handleAlipayNotify(request, {
    db,
    provider: { parseAndVerifyNotify }
  });
  const second = await handleAlipayNotify(request, {
    db,
    provider: { parseAndVerifyNotify }
  });

  const order = db.prepare("SELECT status, provider_trade_no FROM orders WHERE id = ?").get("order-2");
  const user = db.prepare("SELECT points_balance FROM users WHERE id = ?").get("user-1");

  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(order.status, "paid");
  assert.equal(order.provider_trade_no, "trade-1");
  assert.equal(user.points_balance, 2900);
});

test("handleAlipayNotify 在金额不匹配时抛错", async () => {
  const db = makeDb();
  db.prepare(
    `INSERT INTO orders (
      id, user_id, package_id, amount_cents, points, provider, payment_method, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'paying', ?)`
  ).run("order-3", "user-1", "starter", 2900, 2900, "alipay", "alipay_web", Date.now());

  await assert.rejects(
    () =>
      handleAlipayNotify(new Request("https://example.com/api/payments/alipay/notify", { method: "POST" }), {
        db,
        provider: {
          parseAndVerifyNotify: async () => ({
            orderId: "order-3",
            providerTradeNo: "trade-2",
            amountCents: 3000,
            rawPayload: "{\"trade_status\":\"TRADE_SUCCESS\"}",
            paidAt: 1700000000000
          })
        }
      }),
    /支付金额不一致/
  );
});
