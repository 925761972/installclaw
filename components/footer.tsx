import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  const icpBeianNumber = process.env.ICP_BEIAN_NUMBER?.trim() || "浙ICP备2026057497号-1";
  const publicSecurityBeianNumber = "浙公网安备33020302002179号";

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
        <p>请确保你拥有上传视频的处理授权</p>
        <div className="beian-links" aria-label="网站备案信息">
          {icpBeianNumber ? (
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
              {icpBeianNumber}
            </a>
          ) : null}
          <a
            className="public-security-beian"
            href="https://beian.mps.gov.cn/#/query/webSearch?code=33020302002179"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/mps-beian.png"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
            />
            <span>{publicSecurityBeianNumber}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
