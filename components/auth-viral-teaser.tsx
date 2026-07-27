"use client";

import Link from "next/link";
import { Gift, Users } from "lucide-react";

export function AuthViralTeaser({ kind }: { kind: "login" | "register" }) {
  const isLogin = kind === "login";

  return (
    <div className="auth-viral-teaser">
      <div className="auth-viral-teaser-icon">
        <Gift size={18} />
      </div>
      <div className="auth-viral-teaser-body">
        <strong>邀请好友，双方各得 100 积分</strong>
        <span>无邀请上限，多邀多得。已有创作者通过邀请赚取数千积分。</span>
      </div>
      {isLogin && (
        <Link className="auth-viral-teaser-cta" href="/register">
          免费注册
        </Link>
      )}
    </div>
  );
}