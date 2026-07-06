import { Calculator, CheckCircle2, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PricingCards } from "@/components/pricing-cards";
import { PRICING } from "@/lib/pricing";

export default function PricingPage() {
  return <><Header /><main className="pricing-page"><section className="pricing-hero"><span className="eyebrow"><i /> 简单、透明、不会过期</span><h1>先选积分，<br /><em>再选你要的效果。</em></h1><p>积分在两种模式间通用。套餐越大，每积分越便宜；无论选择哪一档，都可以按项目需要灵活切换擦除模式。</p></section><section className="rate-bar"><div><span>标准版</span><strong>{PRICING.rates.standard}</strong><small>积分 / 分钟</small></div><div><span>精细化版</span><strong>{PRICING.rates.pro}</strong><small>积分 / 分钟</small></div><p>提交时按视频真实时长精确冻结，不额外预留安全余量。</p></section><section className="package-section"><div className="section-heading left"><span className="eyebrow">POINT PACKAGES</span><h2>选择适合你的用量</h2></div><PricingCards /></section><section className="pricing-promises"><article><Calculator /><h3>精确结算</h3><p>按真实时长计费，不用为整分钟进位买单。</p></article><article><ShieldCheck /><h3>失败退回</h3><p>提交失败或处理失败，冻结积分自动原路退回账户。</p></article><article><CheckCircle2 /><h3>永久有效</h3><p>购买的积分不设置到期日，按你的创作节奏使用。</p></article></section></main><Footer /></>;
}
