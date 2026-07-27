"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export function AuthForm({ kind, initialInviteCode }: { kind: "login" | "register"; initialInviteCode?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(initialInviteCode || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLogin = kind === "login";

  async function sendCode() {
    if (!email || sendingCode || countdown > 0) return;
    setError("");
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      setCodeSent(true);
      setCountdown(30);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSendingCode(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const body: Record<string, string> = { email, password };
    if (!isLogin) {
      if (!verificationCode) {
        setError("请输入邮箱验证码");
        setLoading(false);
        return;
      }
      body.verificationCode = verificationCode;
      if (inviteCode.trim()) body.inviteCode = inviteCode.trim().toUpperCase();
    }
    const response = await fetch(`/api/auth/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error || "操作失败");
    window.location.href = "/dashboard";
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>邮箱地址<input type="email" autoComplete="email" placeholder="yDIk@qXBvo2k.Nrs" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="password-label">
        密码
        <div className="password-input-wrap">
          <input type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} placeholder={isLogin ? "输入密码" : "至少 8 位"} minLength={isLogin ? 1 : 8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {!isLogin && (
        <label className="verification-code-field">
          邮箱验证码
          <div className="verification-code-row">
            <input
              type="text"
              inputMode="numeric"
              placeholder="6 位数字验证码"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
            />
            <button
              type="button"
              className="button button-ghost send-code-btn"
              onClick={sendCode}
              disabled={sendingCode || countdown > 0}
            >
              {sendingCode ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "发送验证码"}
            </button>
          </div>
        </label>
      )}
      {!isLogin && (
        <label className="invite-code-field">
          邀请码 <small>（选填，填写双方各得 100 积分）</small>
          <input
            type="text"
            placeholder="输入邀请码（选填）"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={8}
            style={{ textTransform: "uppercase", letterSpacing: "2px", fontWeight: 800 }}
          />
        </label>
      )}
      {isLogin && (
        <p className="auth-switch" style={{textAlign: "right", marginTop: "-10px"}}>
          <Link href="/forgot-password">忘记密码？</Link>
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
      <button className="button button-primary button-full" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : null}{isLogin ? "进入工作台" : "创建账号"}<ArrowRight size={18} />
      </button>
      <p className="auth-switch">{isLogin ? "还没有账号？" : "已经注册？"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "免费注册" : "直接登录"}</Link></p>
      {isLogin && (
        <p className="legal-note">
          登录即表示你同意<Link href="/terms">用户协议</Link>和<Link href="/privacy">隐私政策</Link>
        </p>
      )}
    </form>
  );
}
