export type EraseMode = "standard" | "pro";

export const PRICING = {
  pointsPerYuan: 100,
  rates: {
    standard: 120,
    pro: 260
  },
  providerCostYuanPerMinute: {
    standard: 0.4,
    pro: 1
  }
} as const;

export const PACKAGES = [
  { id: "starter", name: "轻量包", priceYuan: 29, points: 2900, badge: "随用随充", note: "约 24 分钟标准 / 11 分钟精细" },
  { id: "creator", name: "创作包", priceYuan: 99, points: 10500, badge: "加赠 600", note: "约 88 分钟标准 / 40 分钟精细" },
  { id: "studio", name: "工作室包", priceYuan: 299, points: 33000, badge: "加赠 3,100", note: "约 275 分钟标准 / 127 分钟精细" },
  { id: "pro", name: "专业包", priceYuan: 799, points: 92000, badge: "加赠 12,100", note: "约 767 分钟标准 / 354 分钟精细" }
] as const;

export function usagePoints(durationSeconds: number, mode: EraseMode) {
  return Math.max(1, Math.ceil((durationSeconds * PRICING.rates[mode]) / 60));
}

export function reservePoints(durationSeconds: number, mode: EraseMode) {
  // 冻结金额等于对应时长的实际应付积分，不额外增加安全余量。
  return usagePoints(durationSeconds, mode);
}

export function packageById(id: string) {
  return PACKAGES.find((item) => item.id === id);
}
