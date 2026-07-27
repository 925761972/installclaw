"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" className="brand">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>净幕</span>
        </Link>
        <div>
          <span className="eyebrow light">FORGOT PASSWORD</span>
          <h1>别担心，<br />我们帮你找回。</h1>
          <p>输入注册邮箱，我们会发送重置链接给你。</p>
        </div>
        <small>AI 字幕擦除 · 按实际时长结算</small>
      </section>
      <section className="auth-card-wrap">
        <Link className="back-home" href="/login"><ArrowLeft size={16} /> 返回登录</Link>
        <div className="auth-card">
          <span className="eyebrow">找回密码</span>
          <h2>重置密码</h2>
          <p>输入你注册时使用的邮箱地址</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              邮箱地址
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {message && <p className="dev-code-hint">{message}</p>}
            <button type="submit" className="button button-primary button-full" disabled={loading}>
              {loading ? <LoaderCircle className="spin" /> : null}
              {loading ? "发送中..." : "发送重置链接"}
            </button>
          </form>
          <p className="auth-switch">
            想起密码了？<Link href="/login">立即登录</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
