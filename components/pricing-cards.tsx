"use client";

import { useState } from "react";
import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { PACKAGES } from "@/lib/pricing";

type Pending = { orderId: string; qrCodeUrl: string } | null;

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
        {PACKAGES.map((pack, index) => (
          <article className={`price-card ${index === 2 ? "featured" : ""}`} key={pack.id}>
            {index === 2 && <span className="popular"><Sparkles size={13} />最受欢迎</span>}
            <div className="price-card-top"><h3>{pack.name}</h3><span>{pack.badge}</span></div>
            <p className="price"><small>¥</small>{pack.priceYuan}</p>
            <p className="points-big">{pack.points.toLocaleString()} <span>积分</span></p>
            <ul><li><Check size={16} />{pack.note}</li><li><Check size={16} />标准 / 精细化通用</li><li><Check size={16} />永久有效</li></ul>
            <button className={`button ${index === 2 ? "button-primary" : "button-outline"} button-full`} onClick={() => void buy(pack.id)} disabled={!!loading}>
              {loading === pack.id && <LoaderCircle className="spin" size={17} />}支付宝支付
            </button>
          </article>
        ))}
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
