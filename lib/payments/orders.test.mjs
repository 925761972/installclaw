import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  applyPaidOrder,
  createPendingOrder,
  preparePaymentDb
} from "./orders.ts";

function makeDb() {
  const db = new Database(":memory:");
  preparePaymentDb(db);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, points_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("user-1", "demo@example.com", "hash", "salt", 0, Date.now());
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
