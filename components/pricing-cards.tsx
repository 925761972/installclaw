"use client";

import { useState } from "react";
import { Check, Gift, LoaderCircle, Sparkles, TrendingUp, Users, X } from "lucide-react";
import { PACKAGES } from "@/lib/pricing";

type Pending = { orderId: string; qrCodeUrl: string } | null;

const SOCIAL_COUNTS = [128, 347, 892, 203];

function computeSavings(pack: (typeof PACKAGES)[number]) {
  const basePoints = pack.priceYuan * 100;
  const bonus = pack.points - basePoints;
  if (bonus <= 0) return null;
  return { points: bonus, yuan: Math.round(bonus / 100) };
}

export function PricingCards() {
  const [loading, setLoading] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState("");

  async function buy(packageId: string) {
    setLoading(packageId);
    setMessage("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId })
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; orderId?: string; kind?: string; html?: string; qrCodeUrl?: string; url?: string }
        | null;

      if (response.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }

      if (!response.ok) {
        setMessage(data?.error || "订单创建失败");
        return;
      }

      if (data?.kind === "html_form" && data.html) {
        document.open();
        document.write(data.html);
        document.close();
        return;
      }

      if (data?.kind === "qr" && data.orderId && data.qrCodeUrl) {
        setPending({ orderId: data.orderId, qrCodeUrl: data.qrCodeUrl });
        return;
      }

      if (data?.kind === "redirect" && data.url) {
        window.location.href = data.url;
        return;
      }

      setMessage("暂不支持当前支付方式");
    } catch {
      setMessage("订单创建失败，请稍后重试");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="pricing-grid">
        {PACKAGES.map((pack, index) => {
          const savings = computeSavings(pack);
          const isFeatured = index === 2;
          const inviteNeeded = Math.ceil(pack.points / 100);
          return (
            <article className={`price-card ${isFeatured ? "featured" : ""}`} key={pack.id}>
              {isFeatured && (
                <span className="popular">
                  <Sparkles size={13} />最受欢迎
                </span>
              )}

              <div className="price-card-top">
                <h3>{pack.name}</h3>
                <span className="price-badge">{pack.badge}</span>
              </div>

              <p className="price"><small>¥</small>{pack.priceYuan}</p>

              <p className="points-big">
                {pack.points.toLocaleString()} <span>积分</span>
              </p>

              {savings && (
                <div className="price-savings">
                  <TrendingUp size={12} />
                  加赠 <strong>{savings.points.toLocaleString()}</strong> 积分（省 ¥{savings.yuan}）
                </div>
              )}
              {!savings && <div className="price-savings empty" />}

              <ul>
                <li><Check size={14} />{pack.note}</li>
                <li><Check size={14} />标准 / 精细化通用</li>
                <li><Check size={14} />永久有效</li>
              </ul>

              <button
                className={`button ${isFeatured ? "button-primary" : "button-outline"} button-full`}
                onClick={() => void buy(pack.id)}
                disabled={!!loading}
              >
                {loading === pack.id && <LoaderCircle className="spin" size={15} />}
                {isFeatured ? "立即购买 · 推荐" : "支付宝支付"}
              </button>

              <div className="price-invite-hint">
                <Gift size={11} />
                <span>或邀请 <strong>{inviteNeeded}</strong> 人免费得</span>
              </div>

              <div className="price-social">
                <Users size={11} />
                <span>{SOCIAL_COUNTS[index]} 位创作者已选</span>
              </div>
            </article>
          );
        })}
      </div>

      {message && <div className="notice success">{message}</div>}

      {pending && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="支付宝扫码支付">
          <div className="pay-modal">
            <button className="icon-button close" onClick={() => setPending(null)} aria-label="关闭"><X /></button>
            <span className="eyebrow">支付宝扫码支付</span>
            <h2>请使用支付宝扫码完成支付</h2>
            <p>当前环境已预留扫码支付能力；若配置为电脑网站支付，将直接跳转支付宝收银台。</p>
            <img src={pending.qrCodeUrl} alt="支付宝支付二维码" />
          </div>
        </div>
      )}
    </>
  );
}