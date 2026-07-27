"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Gift, Share2, Users } from "lucide-react";

type InviteData = {
  inviteCode: string;
  inviteLink: string;
  invitedCount: number;
  totalRewards: number;
  recentInvites: Array<{ email: string; points: number; time: string }>;
};

export function InviteCard() {
  const [data, setData] = useState<InviteData | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [showShareTip, setShowShareTip] = useState(false);

  useEffect(() => {
    fetch("/api/invitations", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => setData(d));
  }, []);

  const copyToClipboard = async (text: string, type: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (!data) {
    return (
      <div className="invite-card loading">
        <div className="invite-skeleton" />
      </div>
    );
  }

  return (
    <div className="invite-card">
      <div className="invite-header">
        <Gift size={20} />
        <div>
          <h3>邀请好友，双方各得 100 积分</h3>
          <p>每成功邀请一位好友注册并激活，你和好友都将获得 100 积分奖励</p>
        </div>
      </div>

      <div className="invite-stats">
        <div className="invite-stat">
          <Users size={16} />
          <strong>{data.invitedCount}</strong>
          <span>已邀请好友</span>
        </div>
        <div className="invite-stat">
          <Gift size={16} />
          <strong>+{data.totalRewards.toLocaleString()}</strong>
          <span>累计获得积分</span>
        </div>
      </div>

      <div className="invite-code-box">
        <div className="invite-code-display">
          <span className="invite-code-label">你的邀请码</span>
          <strong>{data.inviteCode}</strong>
        </div>
        <button
          className="invite-copy-btn"
          onClick={() => copyToClipboard(data.inviteCode, "code")}
        >
          {copied === "code" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          {copied === "code" ? "已复制" : "复制"}
        </button>
      </div>

      <div className="invite-link-box">
        <input readOnly value={data.inviteLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
        <div className="invite-link-actions">
          <button onClick={() => copyToClipboard(data.inviteLink, "link")}>
            {copied === "link" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
          <button onClick={() => setShowShareTip(true)}>
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {data.recentInvites.length > 0 && (
        <div className="invite-recent">
          <span className="invite-recent-title">最近邀请</span>
          <div className="invite-list">
            {data.recentInvites.map((invite, i) => (
              <div key={i} className="invite-list-item">
                <span>{invite.email}</span>
                <small>{invite.time}</small>
                <b>+{invite.points}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {showShareTip && (
        <div className="modal-backdrop" onClick={() => setShowShareTip(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>分享给好友</h3>
            <p>复制邀请链接或邀请码，发送给微信/QQ好友，或分享到朋友圈/社群</p>
            <div className="share-tips">
              <div>💬 私聊发给经常做视频的朋友</div>
              <div>📱 分享到视频创作者社群</div>
              <div>🎬 剪辑完视频后分享给同行</div>
            </div>
            <button className="button button-primary button-full" onClick={() => setShowShareTip(false)}>我知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}
