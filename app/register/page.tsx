"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthViralTeaser } from "@/components/auth-viral-teaser";
import { Logo } from "@/components/logo";
import { Gift } from "lucide-react";

export default function RegisterPage() {
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) setInviteCode(code.toUpperCase());
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-brand-panel register-panel">
        <Logo />
        <div>
          <span className="eyebrow light">START CLEAN</span>
          <h1>少一点遮挡，<br />多一点好画面。</h1>
          <p>注册后即可进入工作台，标准版与精细化版随时切换。</p>
        </div>
        <small>密码采用 scrypt 加盐存储 · 登录会话 HttpOnly</small>
      </section>
      <section className="auth-card-wrap">
        <Link className="back-home" href="/">← 返回首页</Link>
        <div className="auth-card">
          <span className="eyebrow">免费注册</span>
          <h2>创建净幕账号</h2>
          <p>一分钟准备好你的字幕擦除工作台。</p>
          {inviteCode && (
            <div className="invite-banner">
              <Gift size={18} />
              <div>
                <strong>受邀注册奖励</strong>
                <span>填写邀请码 <b>{inviteCode}</b>，注册即得 100 积分奖励！</span>
              </div>
            </div>
          )}
          <AuthForm kind="register" initialInviteCode={inviteCode} />
          <AuthViralTeaser kind="register" />
          <p className="legal-note">
            注册即表示你同意<Link href="/terms">用户协议</Link>、<Link href="/privacy">隐私政策</Link>，并承诺仅处理拥有合法权利的视频内容。
          </p>
        </div>
      </section>
    </main>
  );
}
