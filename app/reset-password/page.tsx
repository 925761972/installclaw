"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="auth-page" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("密码长度不能少于6位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "重置失败");
      setMessage(data.message);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-brand-panel">
          <Link href="/" className="brand"><span className="brand-mark"><i /><i /><i /></span><span>净幕</span></Link>
          <div><span className="eyebrow light">ERROR</span><h1>链接无效</h1><p>请重新申请密码重置链接。</p></div>
          <small>AI 字幕擦除 · 按实际时长结算</small>
        </section>
        <section className="auth-card-wrap">
          <Link className="back-home" href="/login"><ArrowLeft size={16} /> 返回登录</Link>
          <div className="auth-card">
            <span className="eyebrow">错误</span>
            <h2>链接无效</h2>
            <p>未提供有效的重置令牌</p>
            <Link href="/forgot-password" className="button button-primary button-full">重新申请重置</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" className="brand"><span className="brand-mark"><i /><i /><i /></span><span>净幕</span></Link>
        <div>
          <span className="eyebrow light">SET NEW PASSWORD</span>
          <h1>设置新密码</h1>
          <p>请输入你的新密码。</p>
        </div>
        <small>AI 字幕擦除 · 按实际时长结算</small>
      </section>
      <section className="auth-card-wrap">
        <Link className="back-home" href="/login"><ArrowLeft size={16} /> 返回登录</Link>
        <div className="auth-card">
          <span className="eyebrow">重置密码</span>
          <h2>设置新密码</h2>
          {success ? (
            <>
              <p className="dev-code-hint">{message}</p>
              <Link href="/login" className="button button-primary button-full">去登录</Link>
            </>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="password-label">
                新密码
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少6位字符"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <label className="password-label">
                确认新密码
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    required
                    minLength={6}
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {error && <p className="form-error">{error}</p>}
              {message && <p className="dev-code-hint">{message}</p>}
              <button type="submit" className="button button-primary button-full" disabled={loading}>
                {loading ? <LoaderCircle className="spin" /> : null}
                {loading ? "重置中..." : "确认重置密码"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
