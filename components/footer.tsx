import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  const icpBeianNumber = process.env.ICP_BEIAN_NUMBER?.trim() || "浙ICP备2026057497号-1";

  return (
    <footer className="footer">
      <div className="footer-brand">
        <Logo />
        <p>让字幕干净离场，让画面自然留下。</p>
      </div>
      <div className="footer-links">
        <Link href="/terms">用户协议</Link>
        <Link href="/privacy">隐私政策</Link>
      </div>
      <div className="footer-copyright">
        <p>© {new Date().getFullYear()} 净幕 · 宁波铭锦澜泽科技有限公司</p>
        <p className="beian-line">
          请确保你拥有上传视频的处理授权
          {icpBeianNumber ? (
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
              {icpBeianNumber}
            </a>
          ) : null}
        </p>
      </div>
    </footer>
  );
}
