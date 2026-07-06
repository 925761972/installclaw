import test from "node:test";
import assert from "node:assert/strict";
import { isTerminalOrderStatus, normalizePaymentMethod } from "./types.ts";

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
