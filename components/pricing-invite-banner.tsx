"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Gift, Sparkles, TrendingUp, Users } from "lucide-react";

const MILESTONES = [
  { count: 1, bonus: 0, label: "邀请第 1 位好友", desc: "双方各得 100 积分" },
  { count: 3, bonus: 100, label: "累计邀请 3 位", desc: "额外奖励 100 积分" },
  { count: 5, bonus: 200, label: "累计邀请 5 位", desc: "额外奖励 200 积分" },
  { count: 10, bonus: 500, label: "累计邀请 10 位", desc: "额外奖励 500 积分" },
  { count: 20, bonus: 1000, label: "累计邀请 20 位", desc: "额外奖励 1000 积分" },
];

export function PricingInviteBanner() {
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [invitedCount, setInvitedCount] = useState(0);
  const [totalRewards, setTotalRewards] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invitations", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (d.inviteCode) {
          setInviteCode(d.inviteCode);
          setInviteLink(d.inviteLink);
          setInvitedCount(d.invitedCount);
          setTotalRewards(d.totalRewards);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const currentMilestone = useMemo(() => {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (invitedCount >= MILESTONES[i].count) return i;
    }
    return -1;
  }, [invitedCount]);

  const nextMilestone = currentMilestone < MILESTONES.length - 1 ? MILESTONES[currentMilestone + 1] : null;
  const progressPercent = nextMilestone
    ? Math.min(100, Math.round((invitedCount / nextMilestone.count) * 100))
    : 100;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return null;

  const loggedIn = !!inviteCode;

  return (
    <section className="viral-section">
      {/* 英雄区：简洁诚实 */}
      <div className="viral-hero">
        <div className="viral-hero-glow" />
        <h2>
          邀请好友，双方各得 <em>100</em> 积分
        </h2>
        <p>每成功邀请 1 位好友注册，你和好友分别获得 <strong>100 积分</strong>。无邀请上限，多邀多得。</p>
      </div>

      {/* 进度条阶梯：登门槛效应 */}
      <div className="viral-milestones">
        <div className="viral-milestones-header">
          <div>
            <span className="eyebrow">MILESTONE REWARDS</span>
            <h3>邀请越多，奖励越丰厚</h3>
          </div>
          {loggedIn && (
            <div className="viral-milestones-summary">
              <TrendingUp size={14} />
              <span>已邀请 <strong>{invitedCount}</strong> 人，累计获得 <strong>{totalRewards.toLocaleString()}</strong> 积分</span>
            </div>
          )}
        </div>

        <div className="viral-progress-track">
          <div className="viral-progress-bar" style={{ width: `${progressPercent}%` }}>
            <span className="viral-progress-label">{progressPercent}%</span>
          </div>
          {MILESTONES.map((m, i) => {
            const achieved = invitedCount >= m.count;
            const isNext = nextMilestone?.count === m.count;
            return (
              <div
                key={m.count}
                className={`viral-milestone-node ${achieved ? "achieved" : ""} ${isNext ? "next" : ""}`}
                style={{ left: `${(m.count / MILESTONES[MILESTONES.length - 1].count) * 100}%` }}
              >
                <div className="viral-node-icon">
                  {achieved ? <CheckCircle2 size={14} /> : <span>{m.count}</span>}
                </div>
                <div className="viral-node-tooltip">
                  <strong>{m.label}</strong>
                  <span>{m.desc}</span>
                  {m.bonus > 0 && <small className="viral-node-bonus">+{m.bonus} 额外奖励</small>}
                </div>
              </div>
            );
          })}
        </div>

        {nextMilestone && loggedIn && (
          <div className="viral-next-milestone">
            <Sparkles size={14} />
            <span>再邀请 <strong>{nextMilestone.count - invitedCount}</strong> 人即可解锁 <strong>{nextMilestone.label}</strong>，获得 <strong>+{nextMilestone.bonus} 额外积分</strong></span>
          </div>
        )}
      </div>

      {/* 社会证明 + 邀请码 */}
      <div className="viral-actions">
        <div className="viral-social-proof">
          <Users size={15} />
          <div className="viral-social-numbers">
            <div className="viral-social-stat">
              <strong>每位好友</strong>
              <span>为你带来 100 积分</span>
            </div>
            <div className="viral-social-stat">
              <strong className="viral-today">无上限</strong>
              <span>多邀多得</span>
            </div>
          </div>
        </div>

        {loggedIn ? (
          <div className="viral-share-box">
            <div className="viral-invite-code">
              <span className="viral-code-label">你的专属邀请码</span>
              <strong>{inviteCode}</strong>
            </div>
            <div className="viral-share-input-wrap">
              <input readOnly value={inviteLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
              <button className="viral-copy-btn" onClick={copyLink}>
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                {copied ? "已复制" : "复制链接"}
              </button>
            </div>
            <div className="viral-share-channels">
              <span>一键分享：</span>
              <button className="viral-channel wechat" title="微信" onClick={copyLink}>微信</button>
              <button className="viral-channel qq" title="QQ" onClick={copyLink}>QQ</button>
              <button className="viral-channel link" title="复制链接" onClick={copyLink}>复制链接</button>
            </div>
          </div>
        ) : (
          <div className="viral-login-cta">
            <Gift size={20} />
            <div>
              <strong>登录后获取专属邀请链接</strong>
              <span>开始邀请好友赚积分</span>
            </div>
            <a href="/login" className="button button-primary button-small">立即登录</a>
          </div>
        )}
      </div>
    </section>
  );
}