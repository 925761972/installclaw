import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getPaymentProvider } from "./provider.ts";

function withEnv(overrides) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function sortAndJoin(params) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function makeAlipayKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function signParams(params, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(sortAndJoin(params), "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

test("alipay provider 可正常选择", () => {
  const provider = getPaymentProvider("alipay");
  assert.equal(provider.name, "alipay");
});

test("wechat provider 当前返回未启用错误", async () => {
  const provider = getPaymentProvider("wechat");
  await assert.rejects(
    () =>
      provider.createPayment({
        orderId: "order-1",
        amountCents: 1900,
        subject: "净幕充值",
        paymentMethod: "wechat_native",
      }),
    /暂未启用微信支付/
  );
});

test("alipay provider createPayment 返回电脑网站支付表单", async () => {
  const keys = makeAlipayKeys();
  const restoreEnv = withEnv({
    ALIPAY_APP_ID: "app-123",
    ALIPAY_PRIVATE_KEY: keys.privateKey,
    ALIPAY_PUBLIC_KEY: keys.publicKey,
    ALIPAY_NOTIFY_URL: "https://example.com/api/payments/alipay/notify",
    ALIPAY_RETURN_URL: "https://example.com/pricing",
    ALIPAY_GATEWAY_URL: "https://openapi.example.com/gateway.do",
  });

  try {
    const provider = getPaymentProvider("alipay");
    const result = await provider.createPayment({
      orderId: "order-2",
      amountCents: 1900,
      subject: "净幕充值",
      paymentMethod: "alipay_web",
    });

    assert.equal(result.kind, "html_form");
    assert.match(result.html, /https:\/\/openapi\.example\.com\/gateway\.do/);
    assert.match(result.html, /alipay\.trade\.page\.pay/);
    assert.match(result.html, /order-2/);
    assert.match(result.html, /19\.00/);
  } finally {
    restoreEnv();
  }
});

test("alipay provider parseAndVerifyNotify 验签并提取标准字段", async () => {
  const keys = makeAlipayKeys();
  const restoreEnv = withEnv({
    ALIPAY_APP_ID: "app-123",
    ALIPAY_PRIVATE_KEY: keys.privateKey,
    ALIPAY_PUBLIC_KEY: keys.publicKey,
    ALIPAY_NOTIFY_URL: "https://example.com/api/payments/alipay/notify",
    ALIPAY_RETURN_URL: "https://example.com/pricing",
  });

  try {
    const params = {
      app_id: "app-123",
      buyer_id: "2088",
      charset: "utf-8",
      notify_time: "2026-07-03 10:11:12",
      out_trade_no: "order-3",
      seller_id: "2088seller",
      total_amount: "19.00",
      trade_no: "202607030001",
      trade_status: "TRADE_SUCCESS",
    };
    const sign = signParams(params, keys.privateKey);
    const body = new URLSearchParams({ ...params, sign_type: "RSA2", sign });
    const request = new Request("https://example.com/api/payments/alipay/notify", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    });

    const provider = getPaymentProvider("alipay");
    const payload = await provider.parseAndVerifyNotify(request);

    assert.equal(payload.orderId, "order-3");
    assert.equal(payload.providerTradeNo, "202607030001");
    assert.equal(payload.amountCents, 1900);
    assert.equal(typeof payload.rawPayload, "string");
    assert.ok(payload.rawPayload.includes("\"trade_status\":\"TRADE_SUCCESS\""));
    assert.ok(Number.isFinite(payload.paidAt));
  } finally {
    restoreEnv();
  }
});
