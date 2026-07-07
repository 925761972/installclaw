"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export function AuthForm({ kind }: { kind: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = kind === "login";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch(`/api/auth/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
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
      {error && <p className="form-error">{error}</p>}
      <button className="button button-primary button-full" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : null}{isLogin ? "进入工作台" : "创建账号"}<ArrowRight size={18} />
      </button>
      <p className="auth-switch">{isLogin ? "还没有账号？" : "已经注册？"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "免费注册" : "直接登录"}</Link></p>
    </form>
  );
}
