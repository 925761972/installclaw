"use client";

import Link from "next/link";
import { ArrowRight, Gift, Sparkles, Users } from "lucide-react";

export function AuthViralTeaser({ kind }: { kind: "login" | "register" }) {
  const isLogin = kind === "login";

  return (
    <div className="auth-viral-teaser">
      <div className="auth-viral-teaser-icon" aria-hidden="true">
        <Gift size={20} />
      </div>
      <div className="auth-viral-teaser-body">
        <span className="auth-viral-teaser-kicker">
          <Sparkles size={12} aria-hidden="true" />
          好友助力计划
        </span>
        <strong>
          邀请 1 位好友，双方各得 <em>100 积分</em>
        </strong>
        <span className="auth-viral-teaser-proof">
          <Users size={13} aria-hidden="true" />
          奖励自动到账 · 邀请人数不限
        </span>
        {!isLogin && (
          <span className="auth-viral-teaser-next">
            注册后即可生成专属邀请链接
            <ArrowRight size={13} aria-hidden="true" />
          </span>
        )}
      </div>
      {isLogin && (
        <Link className="auth-viral-teaser-cta" href="/register">
          免费注册
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
