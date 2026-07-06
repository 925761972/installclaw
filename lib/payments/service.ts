import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import { db as appDb } from "../db.ts";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import { packageById } from "../pricing.ts";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import { applyPaidOrder, createPendingOrder } from "./orders.ts";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import { getPaymentProvider } from "./provider.ts";
import type {
  PaymentMethod,
  PaymentProvider
} from "./types.ts";

type ProviderResult =
  | { kind: "html_form"; html: string }
  | { kind: "qr"; qrCodeUrl: string }
  | { kind: "redirect"; url: string };

type NotifyPayload = {
  orderId: string;
  providerTradeNo: string;
  amountCents: number;
  rawPayload: string;
  paidAt: number;
};

type CheckoutProvider = {
  createPayment(input: {
    orderId: string;
    amountCents: number;
    subject: string;
    paymentMethod: PaymentMethod;
  }): Promise<ProviderResult>;
};

type NotifyProvider = {
  parseAndVerifyNotify(request: Request): Promise<NotifyPayload>;
};

export function validatePaidAmount(expectedAmountCents: number, paidAmountCents: number) {
  return expectedAmountCents === paidAmountCents;
}

export function buildCheckoutResponse(input: {
  orderId: string;
  paymentMethod: PaymentMethod;
  providerResult: ProviderResult;
}) {
  return {
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    ...input.providerResult
  };
}

export async function createCheckout(
  input: {
    userId: string;
    packageId: string;
    provider: PaymentProvider;
    paymentMethod: PaymentMethod;
  },
  deps: {
    db?: Database.Database;
    provider?: CheckoutProvider;
  } = {}
) {
  const pack = packageById(input.packageId);
  if (!pack) {
    throw new Error("充值套餐不存在");
  }

  const database = deps.db ?? appDb;
  const provider = deps.provider ?? getPaymentProvider(input.provider);
  const orderId = randomUUID();

  createPendingOrder(database, {
    id: orderId,
    userId: input.userId,
    packageId: pack.id,
    amountCents: pack.priceYuan * 100,
    points: pack.points,
    provider: input.provider,
    paymentMethod: input.paymentMethod
  });

  const providerResult = await provider.createPayment({
    orderId,
    amountCents: pack.priceYuan * 100,
    subject: `${pack.name} - 净幕积分充值`,
    paymentMethod: input.paymentMethod
  });

  database.prepare("UPDATE orders SET status = 'paying' WHERE id = ?").run(orderId);

  return buildCheckoutResponse({
    orderId,
    paymentMethod: input.paymentMethod,
    providerResult
  });
}

export async function handleAlipayNotify(
  request: Request,
  deps: {
    db?: Database.Database;
    provider?: NotifyProvider;
  } = {}
) {
  const database = deps.db ?? appDb;
  const provider = deps.provider ?? getPaymentProvider("alipay");
  const payload = await provider.parseAndVerifyNotify(request);
  const order = database.prepare("SELECT amount_cents FROM orders WHERE id = ?").get(payload.orderId) as
    | { amount_cents: number }
    | undefined;

  if (!order) {
    throw new Error("订单不存在");
  }

  if (!validatePaidAmount(order.amount_cents, payload.amountCents)) {
    throw new Error("支付金额不一致");
  }

  return applyPaidOrder(database, {
    orderId: payload.orderId,
    providerTradeNo: payload.providerTradeNo,
    notifyPayload: payload.rawPayload,
    paidAt: payload.paidAt
  });
}
