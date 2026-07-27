"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins, ExternalLink, LogOut, Receipt, UserCircle, WandSparkles } from "lucide-react";

type User = { email: string; points_balance: number; created_at: number };
type Transaction = { id: string; type: string; points: number; amount_cents: number | null; note: string; created_at: number };
type Order = { id: string; package_id: string; amount_cents: number; points: number; status: string; created_at: number; paid_at: number | null };

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function pointsColor(type: string) {
  if (type === "recharge" || type === "bonus" || type === "trial") return "positive";
  if (type === "refund") return "positive";
  return "negative";
}

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  recharge: "充值",
  consume: "处理扣费",
  refund: "失败退款",
  trial: "新用户赠送",
  bonus: "邀请奖励",
  invite_bonus: "邀请奖励"
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  closed: "已关闭",
  failed: "支付失败"
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, txRes] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/me/transactions", { cache: "no-store" })
        ]);
        if (meRes.status === 401) { window.location.href = "/login"; return; }
        const meData = await meRes.json();
        const txData = await txRes.json();
        setUser(meData.user);
        setTransactions(txData.transactions);
        setOrders(txData.orders);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) {
    return <main className="dashboard-shell"><aside className="dash-side"><div className="brand brand-light"><span className="brand-mark"><i /><i /><i /></span><span>净幕</span></div></aside><section className="dash-main"><div className="empty-jobs"><p>加载中...</p></div></section></main>;
  }

  return (
    <main className="dashboard-shell">
      <aside className="dash-side">
        <Link href="/" className="brand brand-light"><span className="brand-mark"><i /><i /><i /></span><span>净幕</span></Link>
        <div className="side-user"><span>{user?.email?.slice(0, 1).toUpperCase() || "·"}</span><div><small>当前账号</small><p>{user?.email || "加载中"}</p></div></div>
        <nav>
          <Link href="/dashboard"><WandSparkles size={18} />字幕擦除</Link>
          <Link href="/dashboard#jobs"><Receipt size={18} />任务记录</Link>
          <Link href="/pricing"><Coins size={18} />充值积分</Link>
          <Link href="/account" className="active"><UserCircle size={18} />账户中心</Link>
        </nav>
        <div className="side-balance"><small>可用积分</small><strong>{user?.points_balance.toLocaleString() ?? "—"}</strong><Link href="/pricing">充值 <ExternalLink size={13} /></Link></div>
        <button className="side-logout" onClick={logout}><LogOut size={16} />退出登录</button>
      </aside>

      <section className="dash-main">
        <div className="dash-heading" id="account">
          <div>
            <span className="eyebrow">MY ACCOUNT</span>
            <h1>账户中心</h1>
            <p>查看你的账户信息、积分变动和充值记录</p>
          </div>
        </div>

        <div className="studio-layout" style={{gridTemplateColumns: "1fr"}}>
          <div className="studio-card">
            <div className="step-title"><span><UserCircle size={16} /></span><div><h2>账户信息</h2></div></div>
            <div className="account-info-grid" style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "24px", marginTop: "20px"
            }}>
              <div><small style={{color:"var(--muted)", fontSize:"11px", fontWeight:900, display:"block", marginBottom:"6px"}}>邮箱地址</small><p style={{margin:0, fontSize:"14px", fontWeight:700}}>{user?.email}</p></div>
              <div><small style={{color:"var(--muted)", fontSize:"11px", fontWeight:900, display:"block", marginBottom:"6px"}}>注册时间</small><p style={{margin:0, fontSize:"14px"}}>{user ? formatDate(user.created_at) : "—"}</p></div>
              <div><small style={{color:"var(--muted)", fontSize:"11px", fontWeight:900, display:"block", marginBottom:"6px"}}>可用积分</small><p style={{margin:0, fontSize:"24px", fontWeight:950, color:"var(--green)"}}>{user?.points_balance.toLocaleString()}</p></div>
            </div>
          </div>

          <div className="studio-card" style={{marginTop: "20px"}}>
            <div className="step-title"><span><Coins size={16} /></span><div><h2>积分变动记录</h2><p style={{margin:0, fontSize:"11px", color:"var(--muted)"}}>最近50条记录</p></div></div>
            {transactions.length === 0 ? (
              <div className="empty-jobs" style={{padding:"40px 20px", marginTop:"20px"}}><UserCircle size={34} /><h3>暂无记录</h3><p>你的积分变动会显示在这里</p></div>
            ) : (
              <div className="jobs-table" style={{marginTop:"16px"}}>
                {transactions.map((tx) => (
                  <div key={tx.id} className="job-row">
                    <div className={`job-status-icon ${pointsColor(tx.type)}`} style={{background: tx.points > 0 ? "#e6f3d4" : "#fff0ec", color: tx.points > 0 ? "#557c1e" : "#ad3c27"}}>
                      {tx.points > 0 ? "+" : "-"}
                    </div>
                    <div className="job-name">
                      <strong>{TRANSACTION_TYPE_LABEL[tx.type] || tx.type}</strong>
                      <span>{formatDate(tx.created_at)}{tx.note ? ` · ${tx.note}` : ""}</span>
                    </div>
                    <span className={`job-cost ${pointsColor(tx.type)}`} style={{color: tx.points > 0 ? "#557c1e" : "#ad3c27", fontWeight: 900}}>
                      {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()} 积分
                    </span>
                    {tx.amount_cents ? (
                      <span style={{fontSize:"10px", color:"var(--muted)", justifySelf:"end"}}>¥{(tx.amount_cents / 100).toFixed(2)}</span>
                    ) : <span className="download-placeholder">—</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="studio-card" style={{marginTop: "20px"}}>
            <div className="step-title"><span><Receipt size={16} /></span><div><h2>充值订单记录</h2><p style={{margin:0, fontSize:"11px", color:"var(--muted)"}}>最近20条订单</p></div></div>
            {orders.length === 0 ? (
              <div className="empty-jobs" style={{padding:"40px 20px", marginTop:"20px"}}><Receipt size={34} /><h3>暂无充值订单</h3><p>去充值页购买积分包吧<Link href="/pricing" style={{fontWeight:800, borderBottom:"1px solid"}}>立即充值 →</Link></p></div>
            ) : (
              <div className="jobs-table" style={{marginTop:"16px"}}>
                {orders.map((order) => (
                  <div key={order.id} className="job-row">
                    <div className={`job-status-icon ${order.status}`}>
                      {order.status === "paid" ? "✓" : order.status === "closed" ? "×" : "…"}
                    </div>
                    <div className="job-name">
                      <strong>订单 {order.id.slice(0, 8)}</strong>
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                    <span className={`status-badge ${order.status}`}>
                      {ORDER_STATUS_LABEL[order.status] || order.status}
                    </span>
                    <span className="job-cost">{order.points.toLocaleString()} 积分</span>
                    <span className="job-cost">¥{(order.amount_cents / 100).toFixed(2)}</span>
                    {order.status === "pending" ? (
                      <div className="job-actions">
                        <Link href={`/pricing?order=${order.id}`} className="preview-button">继续支付</Link>
                      </div>
                    ) : <span className="download-placeholder">—</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
