import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return <main className="auth-page"><section className="auth-brand-panel"><Logo /><div><span className="eyebrow light">WELCOME BACK</span><h1>继续把画面，<br />收拾得干干净净。</h1><p>任务、积分和成片都在原处等你。</p></div><small>AI 字幕擦除 · 按实际时长结算</small></section><section className="auth-card-wrap"><Link className="back-home" href="/">← 返回首页</Link><div className="auth-card"><span className="eyebrow">账号登录</span><h2>欢迎回来</h2><p>用注册邮箱继续进入净幕工作台。</p><AuthForm kind="login" /></div></section></main>;
}
