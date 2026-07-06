import { db } from "@/lib/db";
export const HELPER_TRIAL_LIMIT = 3;
export const helperPlans = [
  { id: "helper_monthly", name: "月度会员", priceYuan: 39, months: 1, description: "适合短期剪辑和临时素材处理" },
  { id: "helper_quarterly", name: "季度会员", priceYuan: 99, months: 3, description: "比月付更划算，适合稳定创作" },
  { id: "helper_yearly", name: "年度会员", priceYuan: 299, months: 12, description: "长期素材处理首选" }
] as const;
export function getHelperPlan(planId: string) { return helperPlans.find((plan) => plan.id === planId); }
export function addMonths(timestamp: number, months: number) { const date = new Date(timestamp); date.setMonth(date.getMonth() + months); return date.getTime(); }
export function getHelperLicenseStatus(userId: string, deviceId: string) {
  const now = Date.now();
  const membership = db.prepare("SELECT plan_id,status,starts_at,expires_at FROM helper_memberships WHERE user_id=?").get(userId) as { plan_id:string; status:string; starts_at:number; expires_at:number } | undefined;
  const active = membership?.status === "active" && membership.expires_at > now ? membership : null;
  const usage = db.prepare("SELECT used_count FROM helper_trial_usage WHERE user_id=? AND device_id=?").get(userId, deviceId) as { used_count:number } | undefined;
  const used = usage?.used_count ?? 0;
  const trialRemaining = Math.max(0, HELPER_TRIAL_LIMIT - used);
  return { isMember: !!active, planId: active?.plan_id ?? null, expiresAt: active?.expires_at ?? null, trialLimit: HELPER_TRIAL_LIMIT, trialUsed: used, trialRemaining, canDownload: !!active || trialRemaining > 0, plans: helperPlans };
}
