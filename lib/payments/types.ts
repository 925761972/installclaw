export const PAYMENT_PROVIDERS = ["alipay", "wechat"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = [
  "alipay_web",
  "alipay_qr",
  "wechat_native",
  "wechat_jsapi",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUSES = [
  "pending",
  "paying",
  "paid",
  "closed",
  "failed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function normalizePaymentMethod(value: string): PaymentMethod | null {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === "paid" || status === "closed" || status === "failed";
}
