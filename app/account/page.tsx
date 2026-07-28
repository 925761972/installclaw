"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleCheckBig,
  CircleX,
  Clock3,
  Coins,
  ExternalLink,
  LogOut,
  Receipt,
  RefreshCw,
  UserCircle,
  WandSparkles
} from "lucide-react";
import { PACKAGES } from "@/lib/pricing";

type User = { email: string; points_balance: number; created_at: number };
type Transaction = { id: string; type: string; points: number; amount_cents: number | null; note: string; created_at: number };
type Order = {
  id: string;
  package_id: string;
  amount_cents: number;
  points: number;
  provider: string | null;
  payment_method: string | null;
  status: string;
  provider_trade_no: string | null;
  created_at: number;
  paid_at: number | null;
  closed_at: number | null;
  expires_at: number | null;
};
type OrderFilter = "all" | "open" | "paid" | "failed";

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
  paying: "支付处理中",
  paid: "已到账",
  closed: "已关闭",
  failed: "支付失败"
};

const PACKAGE_NAME = Object.fromEntries(PACKAGES.map((item) => [item.id, item.name]));

function orderStatusIcon(status: string) {
  if (status === "paid") return <CircleCheckBig size={16} />;
  if (status === "failed" || status === "closed") return <CircleX size={16} />;
  return <Clock3 size={16} />;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [recordError, setRecordError] = useState("");

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    setRecordError("");
    try {
      const [meRes, txRes] = await Promise.all([
        fetch("/api/me", { cache: "no-store" }),
        fetch("/api/me/transactions", { cache: "no-store" })
      ]);
      if (meRes.status === 401) { window.location.href = "/login"; return; }
      if (!meRes.ok || !txRes.ok) throw new Error("账户记录加载失败");
      const meData = await meRes.json();
      const txData = await txRes.json();
      setUser(meData.user);
      setTransactions(txData.transactions ?? []);
      setOrders(txData.orders ?? []);
    } catch {
      setRecordError("充值记录暂时加载失败，请稍后刷新");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasOpenOrder = orders.some((order) => order.status === "pending" || order.status === "paying");

  useEffect(() => {
    if (!hasOpenOrder) return;
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [hasOpenOrder, load]);

  useEffect(() => {
    if (loading || window.location.hash !== "#recharge-orders") return;
    window.requestAnimationFrame(() => {
      document.getElementById("recharge-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading]);

  const orderCounts = useMemo(() => ({
    all: orders.length,
    open: orders.filter((order) => order.status === "pending" || order.status === "paying").length,
    paid: orders.filter((order) => order.status === "paid").length,
    failed: orders.filter((order) => order.status === "failed" || order.status === "closed").length
  }), [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (orderFilter === "open") return order.status === "pending" || order.status === "paying";
    if (orderFilter === "paid") return order.status === "paid";
    if (orderFilter === "failed") return order.status === "failed" || order.status === "closed";
    return true;
  }), [orderFilter, orders]);

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
          <Link href="/account#recharge-orders" className="active"><Receipt size={18} />充值记录</Link>
          <Link href="/account"><UserCircle size={18} />账户中心</Link>
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
              <div
                className={`jobs-table account-record-scroll account-points-scroll${transactions.length > 4 ? " is-scrollable" : ""}`}
                style={{marginTop:"16px"}}
                tabIndex={transactions.length > 4 ? 0 : undefined}
                aria-label={transactions.length > 4 ? "积分变动记录，可上下滚动查看更多" : "积分变动记录"}
              >
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
            {transactions.length > 4 ? <p className="account-scroll-hint">上下滚动查看更多积分记录</p> : null}
          </div>

          <div className="studio-card recharge-records-card" id="recharge-orders" style={{marginTop: "20px"}}>
            <div className="recharge-records-heading">
              <div className="step-title"><span><Receipt size={16} /></span><div><h2>充值记录</h2><p>查看订单号、支付状态和到账情况</p></div></div>
              <button className="icon-text-button" type="button" disabled={refreshing} onClick={() => void load(true)}>
                <RefreshCw size={14} className={refreshing ? "spin" : ""} />{refreshing ? "刷新中" : "刷新记录"}
              </button>
            </div>

            <div className="recharge-summary">
              <button className={orderFilter === "all" ? "active" : ""} onClick={() => setOrderFilter("all")}>
                <Receipt size={17} /><span>全部订单<strong>{orderCounts.all}</strong></span>
              </button>
              <button className={orderFilter === "open" ? "active" : ""} onClick={() => setOrderFilter("open")}>
                <Clock3 size={17} /><span>待支付/处理中<strong>{orderCounts.open}</strong></span>
              </button>
              <button className={orderFilter === "paid" ? "active" : ""} onClick={() => setOrderFilter("paid")}>
                <CircleCheckBig size={17} /><span>已到账<strong>{orderCounts.paid}</strong></span>
              </button>
              <button className={orderFilter === "failed" ? "active" : ""} onClick={() => setOrderFilter("failed")}>
                <CircleX size={17} /><span>失败/关闭<strong>{orderCounts.failed}</strong></span>
              </button>
            </div>

            {hasOpenOrder ? (
              <p className="recharge-auto-refresh"><i />存在未完成订单，本页每 15 秒自动刷新到账状态。</p>
            ) : null}
            {recordError ? <p className="recharge-load-error">{recordError}</p> : null}

            {orders.length === 0 ? (
              <div className="empty-jobs" style={{padding:"40px 20px", marginTop:"20px"}}><Receipt size={34} /><h3>暂无充值订单</h3><p>去充值页购买积分包吧<Link href="/pricing" style={{fontWeight:800, borderBottom:"1px solid"}}>立即充值 →</Link></p></div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-jobs" style={{padding:"40px 20px", marginTop:"20px"}}><Receipt size={34} /><h3>当前分类暂无订单</h3><p>可切换上方状态查看其他充值记录</p></div>
            ) : (
              <div
                key={orderFilter}
                className={`recharge-table account-record-scroll recharge-orders-scroll${filteredOrders.length > 6 ? " is-scrollable" : ""}`}
                tabIndex={filteredOrders.length > 6 ? 0 : undefined}
                aria-label={filteredOrders.length > 6 ? "充值记录，可上下滚动查看更多" : "充值记录"}
              >
                <div className="recharge-table-head">
                  <span>订单信息</span><span>支付状态</span><span>充值内容</span><span>支付金额</span><span>完成时间</span>
                </div>
                {filteredOrders.map((order) => (
                  <div key={order.id} className="recharge-row">
                    <div className="recharge-order-identity">
                      <div className={`recharge-status-icon ${order.status}`}>{orderStatusIcon(order.status)}</div>
                      <div>
                        <strong>{PACKAGE_NAME[order.package_id] ?? order.package_id}</strong>
                        <span title={order.id}>网站订单号：{order.id}</span>
                        <span title={order.provider_trade_no ?? ""}>支付宝交易号：{order.provider_trade_no ?? "—"}</span>
                        <small>创建于 {formatDate(order.created_at)}</small>
                      </div>
                    </div>
                    <span className={`recharge-status-badge ${order.status}`}>
                      {ORDER_STATUS_LABEL[order.status] || order.status}
                    </span>
                    <strong className="recharge-points">+{order.points.toLocaleString()} 积分</strong>
                    <strong className="recharge-amount">¥{(order.amount_cents / 100).toFixed(2)}</strong>
                    <span className="recharge-paid-at">{order.paid_at ? formatDate(order.paid_at) : "—"}</span>
                    {order.status === "pending" ? (
                      <Link href="/pricing" className="recharge-again-link">重新选择套餐</Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {filteredOrders.length > 6 ? <p className="account-scroll-hint">上下滚动查看更多充值记录</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
