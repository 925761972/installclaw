"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Zap } from "lucide-react";

export function InviteStrip() {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invitations", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => { if (d.inviteCode) setInviteCode(d.inviteCode); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className="invite-strip">
      <div className="invite-strip-inner">
        <div className="invite-strip-left">
          <Zap size={14} />
          <span>邀请好友注册，双方各得 <strong>100 积分</strong>，无上限</span>
        </div>
        <Link className="invite-strip-link" href={inviteCode ? "/invite" : "/login"}>
          <Gift size={13} />
          {inviteCode ? "我的邀请码" : "登录参与"}
        </Link>
      </div>
    </div>
  );
}