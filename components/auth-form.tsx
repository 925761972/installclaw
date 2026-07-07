"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function AuthForm({ kind }: { kind: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState("");
  const isLogin = kind === "login";

  async function sendVerificationCode() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请先输入有效邮箱地址");
      return;
    }
    setError("");
    setSendingCode(true);
    const response = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    setSendingCode(false);
    if (!response.ok) {
      if (data.waitSeconds) {
        setCountdown(data.waitSeconds);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      return setError(data.error || "发送失败");
    }
    setCodeSent(true);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    if (data.devCode) {
      setDevCode(data.devCode);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const body: Record<string, string> = { email, password };
    if (!isLogin) body.code = code;
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
      {!isLogin && (
        <label className="code-field">
          邮箱验证码
          <div className="code-input-row">
            <input type="text" placeholder="请输入6位验证码" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required={!isLogin} />
            <button type="button" className="button button-secondary" onClick={sendVerificationCode} disabled={sendingCode || countdown > 0}>
              {sendingCode ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "发送验证码"}
            </button>
          </div>
          {devCode && <p className="dev-code-hint">开发模式验证码：{devCode}</p>}
        </label>
      )}
      <label>密码<input type="password" autoComplete={isLogin ? "current-password" : "new-password"} placeholder={isLogin ? "输入密码" : "至少 8 位"} minLength={isLogin ? 1 : 8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-primary button-full" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : null}{isLogin ? "进入工作台" : "创建账号"}<ArrowRight size={18} />
      </button>
      <p className="auth-switch">{isLogin ? "还没有账号？" : "已经注册？"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "免费注册" : "直接登录"}</Link></p>
    </form>
  );
}
