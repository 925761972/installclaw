import Link from "next/link";
import { ArrowRight, Check, Cloud, Download, DownloadCloud, FileVideo, Globe, Key, Lock, MonitorPlay, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function HomePage() {
  return (
    <><Header /><main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow"><i /> 微信视频号下载工具</span><h1>视频号视频，<br /><em>一键批量下载。</em></h1><p>净幕视频号助手，轻松下载微信视频号所有视频。支持批量下载、加密视频自动解密、智能去重，简单好用。</p><div className="hero-actions"><Link className="button button-primary button-large" href="/register">下载使用 <ArrowRight size={19} /></Link><Link className="text-link" href="#features">核心功能 <span>↓</span></Link></div><div className="trust-row"><span><Check />一键下载</span><span><Check />批量处理</span><span><Check />自动解密</span></div></div>
        <div className="hero-visual" aria-label="视频号助手效果示意">
          <div className="visual-label before">下载前</div><div className="visual-label after">下载后</div>
          <div className="video-scene channel-scene"><div className="phone-frame"><div className="phone-header"><div className="phone-dots" /><span>视频号</span></div><div className="channel-video"><div className="play-button">▶</div><div className="channel-subtitle">点击下载按钮即可保存视频</div><div className="download-fab" aria-hidden="true">↓</div></div></div></div>
          <div className="floating-card"><span><DownloadCloud size={16} />批量下载</span><strong>下载完成</strong><div><i /><i /><i /><i /><i /></div></div>
        </div>
      </section>

      <section className="metric-strip"><div><strong>一键</strong><span>下载操作</span></div><div><strong>批量</strong><span>多视频同时处理</span></div><div><strong>自动</strong><span>加密视频解密</span></div><div><strong>永久</strong><span>本地保存使用</span></div></section>

      <section className="how-section" id="how"><div className="section-heading"><span className="eyebrow">EASY TO USE</span><h2>三步，轻松下载视频</h2><p>无需复杂配置，打开即用。</p></div><div className="steps-grid"><article><span className="step-number">01</span><div className="step-icon"><Download /></div><h3>下载启动</h3><p>下载程序压缩包，解压后双击启动，首次使用自动安装证书。</p></article><article><span className="step-number">02</span><div className="step-icon"><MonitorPlay /></div><h3>浏览视频</h3><p>打开微信电脑版，进入视频号页面浏览你想要保存的视频。</p></article><article><span className="step-number">03</span><div className="step-icon"><FileVideo /></div><h3>一键下载</h3><p>页面自动注入下载按钮，点击即可保存，支持批量选择下载。</p></article></div></section>

      <section className="quality-section" id="features"><div className="quality-intro"><span className="eyebrow">POWERFUL FEATURES</span><h2>专为视频号打造，<br />功能强大好用。</h2><p>从单个视频下载到批量处理，从加密解密到本地管理，满足你的所有需求。</p><Link className="text-link dark" href="/pricing">查看会员价格 <ArrowRight size={16} /></Link></div><div className="quality-cards"><article className="quality-card standard"><div className="quality-top"><span>核心功能</span><small>简单高效</small></div><h3>下载管理</h3><ul><li><Check />单个视频一键下载</li><li><Check />批量选择多个视频</li><li><Check />加密视频自动解密</li><li><Check />断点续传不怕中断</li><li><Check />智能去重避免重复</li></ul><div className="mini-scene channel-mini"><div className="mini-download-icon">↓</div><div className="mini-file-list"><span></span><span></span><span></span></div></div></article><article className="quality-card fine"><div className="quality-top"><span><Sparkles size={15} />会员功能</span><small>高级体验</small></div><h3>更多能力</h3><ul><li><Check />Web 控制台管理</li><li><Check />浏览历史记录</li><li><Check />下载队列实时查看</li><li><Check />数据 JSON/CSV 导出</li><li><Check />作者视频批量抓取</li></ul><div className="mini-scene fine-scene channel-pro"><div className="mesh" /><div className="clean-badge">控制台</div></div></article></div></section>

      <section className="points-explain"><div><span className="eyebrow">WHY CHOOSE US</span><h2>为什么选择净幕助手？</h2></div><div className="feature-grid-explain"><div className="feature-item"><ShieldCheck size={24} /><strong>安全可靠</strong><p>本地运行，不上传你的账号信息，保护隐私安全。</p></div><div className="feature-item"><Zap size={24} /><strong>极速下载</strong><p>多线程并发下载，充分利用带宽，快速完成。</p></div><div className="feature-item"><Globe size={24} /><strong>简单易用</strong><p>无需复杂配置，解压即用，新手也能快速上手。</p></div><div className="feature-item"><Lock size={24} /><strong>自动解密</strong><p>加密视频自动处理，下载后直接播放无需额外操作。</p></div></div><p>永久免费试用基础功能，开通会员解锁批量下载、高级控制台等全部功能。</p></section>

      <section className="cta-section"><span className="eyebrow light">START DOWNLOADING NOW</span><h2>想要保存的视频，<br />现在就开始下载。</h2><Link className="button button-light button-large" href="/register">免费注册账号 <ArrowRight size={19} /></Link></section>
    </main><Footer /></>
  );
}
