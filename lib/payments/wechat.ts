// @ts-ignore Node test runner resolves TypeScript source files by explicit extension here.
import type { PaymentProviderDriver } from "./provider.ts";

const NOT_ENABLED_ERROR = "暂未启用微信支付";

export function createWechatProvider(): PaymentProviderDriver {
  return {
    name: "wechat",
    async createPayment() {
      throw new Error(NOT_ENABLED_ERROR);
    },
    async parseAndVerifyNotify() {
      throw new Error(NOT_ENABLED_ERROR);
    },
  };
}
