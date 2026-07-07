import Link from "next/link";
import { ArrowRight, Check, Clock3, Coins, FileVideo, ShieldCheck, Sparkles, UploadCloud, WandSparkles } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PRICING } from "@/lib/pricing";

export default function HomePage() {
  return (
    <><Header /><main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow"><i /> AI 视频画面修复</span><h1>字幕该走了。<br /><em>画面留下来。</em></h1><p>上传视频，自动识别并擦除硬字幕。两种处理模式，从高效批量到细腻无痕，一处搞定。</p><div className="hero-actions"><Link className="button button-primary button-large" href="/register">免费开始 <ArrowRight size={19} /></Link><Link className="text-link" href="#quality">看看两种模式 <span>↓</span></Link></div><div className="trust-row"><span><Check />无需安装软件</span><span><Check />失败自动退回积分</span><span><Check />API Key 服务端隔离</span></div></div>
        <div className="hero-visual" aria-label="字幕擦除效果示意">
          <div className="visual-label before">处理前</div><div className="visual-label after">处理后</div>
          <div className="video-scene"><div className="sun" /><div className="mountain one" /><div className="mountain two" /><div className="lake" /><div className="subtitle-old">有些风景，不需要解释。</div><div className="erase-line"><span><WandSparkles size={16} /></span></div></div>
          <div className="floating-card"><span><Sparkles size={16} />精细化擦除</span><strong>画面重建完成</strong><div><i /><i /><i /><i /><i /></div></div>
        </div>
      </section>

      <section className="metric-strip"><div><strong>2 种</strong><span>擦除模式</span></div><div><strong>毫秒级</strong><span>按实际时长结算</span></div><div><strong>24h</strong><span>结果链接有效期</span></div><div><strong>最高 2K</strong><span>输入视频分辨率</span></div></section>

      <section className="how-section" id="how"><div className="section-heading"><span className="eyebrow">SIMPLE, ON PURPOSE</span><h2>三步，还画面一个清净</h2><p>不需要剪辑经验，也不需要理解复杂参数。</p></div><div className="steps-grid"><article><span className="step-number">01</span><div className="step-icon"><UploadCloud /></div><h3>添加视频</h3><p>从本地上传，或粘贴可公开访问的视频地址。</p></article><article><span className="step-number">02</span><div className="step-icon"><WandSparkles /></div><h3>选择模式</h3><p>标准版追求效率；精细化版追求复杂背景下的自然修复。</p></article><article><span className="step-number">03</span><div className="step-icon"><FileVideo /></div><h3>取回成片</h3><p>任务完成即可下载 MP4 成片，积分按实际输出时长结算。</p></article></div></section>

      <section className="quality-section" id="quality"><div className="quality-intro"><span className="eyebrow">TWO WAYS TO CLEAN</span><h2>不是所有字幕，<br />都该用同一种方式。</h2><p>日常口播和批量素材，标准版够快够稳；遇到运动背景、人物遮挡和纹理变化，精细化版会把更多时间花在画面重建上。</p><Link className="text-link dark" href="/pricing">查看完整价格 <ArrowRight size={16} /></Link></div><div className="quality-cards"><article className="quality-card standard"><div className="quality-top"><span>标准版</span><small>效率优先</small></div><h3>快、稳、适合跑量</h3><ul><li><Check />自动检测画面硬字幕</li><li><Check />适合固定机位与简单背景</li><li><Check />{PRICING.rates.standard} 积分 / 分钟</li></ul><div className="mini-scene"><div className="caption-block" /><div className="speed-lines"><i /><i /><i /></div></div></article><article className="quality-card fine"><div className="quality-top"><span><Sparkles size={15} />精细化版</span><small>效果优先</small></div><h3>复杂画面，也要自然</h3><ul><li><Check />高帧率 OCR 与时序分析</li><li><Check />支持自定义擦除区域</li><li><Check />{PRICING.rates.pro} 积分 / 分钟</li></ul><div className="mini-scene fine-scene"><div className="mesh" /><div className="clean-badge">纹理重建</div></div></article></div></section>

      <section className="points-explain"><div><span className="eyebrow">FAIR BILLING</span><h2>只为真正处理的时长付费</h2></div><div className="billing-flow"><span><Coins />充值积分</span><i>→</i><span><Clock3 />核验真实时长</span><i>→</i><span><ShieldCheck />精确冻结积分</span></div><p>提交任务时由服务端读取视频真实时长，只冻结本次应付积分，不额外增加安全余量；任务失败则全额退回冻结积分。</p></section>

      <section className="cta-section"><span className="eyebrow light">YOUR CLEAN FRAME STARTS HERE</span><h2>第一条干净的视频，<br />现在就可以开始。</h2><Link className="button button-light button-large" href="/register">创建免费账号 <ArrowRight size={19} /></Link></section>
    </main><Footer /></>
  );
}
