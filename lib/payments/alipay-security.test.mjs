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
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function makeKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function sortAndJoin(params) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signParams(params, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(sortAndJoin(params), "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

test("Alipay accepts raw base64 keys from environment variables", async () => {
  const keys = makeKeys();
  const restore = withEnv({
    ALIPAY_APP_ID: "app-123",
    ALIPAY_PRIVATE_KEY: keys.privateKey.replace(
      /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
      ""
    ),
    ALIPAY_PUBLIC_KEY: keys.publicKey.replace(
      /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,
      ""
    ),
    ALIPAY_NOTIFY_URL: "https://example.com/api/payments/alipay/notify",
    ALIPAY_RETURN_URL: "https://example.com/pricing",
  });

  try {
    const result = await getPaymentProvider("alipay").createPayment({
      orderId: "order-raw-key",
      amountCents: 100,
      subject: "payment",
      paymentMethod: "alipay_web",
    });
    assert.equal(result.kind, "html_form");
    assert.match(result.html, /timeout_express/);
    assert.match(result.html, /30m/);
  } finally {
    restore();
  }
});

test("Alipay rejects a signed callback for another app", async () => {
  const keys = makeKeys();
  const restore = withEnv({
    ALIPAY_APP_ID: "app-123",
    ALIPAY_PRIVATE_KEY: keys.privateKey,
    ALIPAY_PUBLIC_KEY: keys.publicKey,
    ALIPAY_NOTIFY_URL: "https://example.com/api/payments/alipay/notify",
    ALIPAY_RETURN_URL: "https://example.com/pricing",
  });

  try {
    const params = {
      app_id: "another-app",
      out_trade_no: "order-4",
      total_amount: "19.00",
      trade_no: "202607030002",
      trade_status: "TRADE_SUCCESS",
    };
    const sign = signParams(params, keys.privateKey);
    const request = new Request("https://example.com/api/payments/alipay/notify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ ...params, sign_type: "RSA2", sign }),
    });

    await assert.rejects(
      () => getPaymentProvider("alipay").parseAndVerifyNotify(request),
      /APPID/
    );
  } finally {
    restore();
  }
});
