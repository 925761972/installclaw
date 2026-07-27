import { Calculator, CheckCircle2, Clock, ShieldCheck, Zap } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PricingCards } from "@/components/pricing-cards";
import { InviteStrip } from "@/components/invite-strip";
import { PRICING } from "@/lib/pricing";

export default function PricingPage() {
  return (
    <>
      <Header />
      <InviteStrip />
      <main className="pricing-page">
        {/* 紧凑 Hero */}
        <section className="pricing-hero-compact">
          <span className="eyebrow"><Zap size={12} /> 简单透明 · 永久有效</span>
          <h1>选择你的<em>积分套餐</em></h1>
          <p>标准版 <strong>{PRICING.rates.standard}</strong> 积分/分钟 · 精细化版 <strong>{PRICING.rates.pro}</strong> 积分/分钟 · 按真实时长精确结算</p>
        </section>

        {/* 套餐卡片 — 首屏核心 */}
        <section className="package-section">
          <PricingCards />
        </section>

        {/* 信任条 */}
        <section className="pricing-trust-strip">
          <div><Clock size={15} /><span>2 分钟出结果</span></div>
          <div><ShieldCheck size={15} /><span>失败全额退回</span></div>
          <div><Calculator size={15} /><span>精确到秒计费</span></div>
          <div><CheckCircle2 size={15} /><span>积分永久有效</span></div>
        </section>
      </main>
      <Footer />
    </>
  );
}