// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import { createAlipayProvider } from "./alipay.ts";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import { createWechatProvider } from "./wechat.ts";
// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import type { PaymentMethod, PaymentProvider } from "./types.ts";

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

export function getPaymentProvider(provider: PaymentProvider): PaymentProviderDriver {
  if (provider === "alipay") {
    return createAlipayProvider();
  }

  return createWechatProvider();
}
