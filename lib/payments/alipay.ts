import crypto from "node:crypto";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentNotifyPayload,
  PaymentProviderDriver,
} from "./provider.ts";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

function formatAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function normalizePemKey(value: string, type: "PRIVATE KEY" | "PUBLIC KEY"): string {
  const normalized = value.trim().replace(/\\n/g, "\n");
  if (normalized.includes("-----BEGIN")) {
    return normalized;
  }

  const body = normalized.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

function sortAndJoin(
  params: Record<string, string>,
  excludeSignType = false
): string {
  return Object.keys(params)
    .filter(
      (key) =>
        key !== "sign" &&
        (!excludeSignType || key !== "sign_type") &&
        params[key] !== ""
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signParams(content: string, privateKey: string): string {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(normalizePemKey(privateKey, "PRIVATE KEY"), "base64");
}

function verifyParams(content: string, signature: string, publicKey: string): boolean {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(content, "utf8");
  verifier.end();
  return verifier.verify(normalizePemKey(publicKey, "PUBLIC KEY"), signature, "base64");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parsePaidAt(notifyTime: string | undefined): number {
  if (!notifyTime) {
    return Date.now();
  }

  const normalized = notifyTime.replace(" ", "T");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function createAlipayProvider(): PaymentProviderDriver {
  return {
    name: "alipay",
    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
      const appId = getRequiredEnv("ALIPAY_APP_ID");
      const privateKey = getRequiredEnv("ALIPAY_PRIVATE_KEY");
      const notifyUrl = getRequiredEnv("ALIPAY_NOTIFY_URL");
      const returnUrl = getRequiredEnv("ALIPAY_RETURN_URL");
      const gateway = process.env.ALIPAY_GATEWAY_URL || "https://openapi.alipay.com/gateway.do";

      if (input.paymentMethod === "alipay_qr") {
        return { kind: "qr", qrCodeUrl: "" };
      }

      const params: Record<string, string> = {
        app_id: appId,
        method: "alipay.trade.page.pay",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        version: "1.0",
        notify_url: notifyUrl,
        return_url: returnUrl,
        biz_content: JSON.stringify({
          out_trade_no: input.orderId,
          product_code: "FAST_INSTANT_TRADE_PAY",
          total_amount: formatAmount(input.amountCents),
          subject: input.subject,
        }),
      };

      params.sign = signParams(sortAndJoin(params), privateKey);

      const { biz_content: bizContent, ...gatewayParams } = params;
      const separator = gateway.includes("?") ? "&" : "?";
      const actionUrl = `${gateway}${separator}${new URLSearchParams(gatewayParams).toString()}`;
      const html = Object.entries({ biz_content: bizContent })
        .map(
          ([key, value]) =>
            `<input type="hidden" name="${escapeHtmlAttribute(key)}" value="${escapeHtmlAttribute(value)}" />`
        )
        .join("");

      return {
        kind: "html_form",
        html: `<meta charset="utf-8" /><form id="alipay-submit" method="POST" accept-charset="UTF-8" action="${escapeHtmlAttribute(actionUrl)}">${html}</form><script>document.getElementById('alipay-submit').submit();</script>`,
      };
    },

    async parseAndVerifyNotify(request: Request): Promise<PaymentNotifyPayload> {
      const formData = await request.formData();
      const params = Object.fromEntries(
        [...formData.entries()].map(([key, value]) => [key, String(value)])
      ) as Record<string, string>;
      const signature = params.sign || "";
      const publicKey = getRequiredEnv("ALIPAY_PUBLIC_KEY");

      const hasValidSignature =
        signature &&
        (verifyParams(sortAndJoin(params), signature, publicKey) ||
          verifyParams(sortAndJoin(params, true), signature, publicKey));

      if (!hasValidSignature) {
        throw new Error("支付宝回调验签失败");
      }

      if (params.app_id !== getRequiredEnv("ALIPAY_APP_ID")) {
        throw new Error("支付宝回调 APPID 不匹配");
      }

      const sellerId = process.env.ALIPAY_SELLER_ID?.trim();
      if (sellerId && params.seller_id !== sellerId) {
        throw new Error("支付宝回调收款账号不匹配");
      }

      if (params.trade_status !== "TRADE_SUCCESS" && params.trade_status !== "TRADE_FINISHED") {
        throw new Error("支付宝交易未成功");
      }

      const amountCents = Math.round(Number(params.total_amount) * 100);
      if (
        !params.out_trade_no ||
        !params.trade_no ||
        !Number.isSafeInteger(amountCents) ||
        amountCents <= 0
      ) {
        throw new Error("支付宝回调订单字段无效");
      }

      return {
        orderId: params.out_trade_no,
        providerTradeNo: params.trade_no,
        amountCents,
        rawPayload: JSON.stringify(params),
        paidAt: parsePaidAt(params.notify_time),
      };
    },
  };
}
