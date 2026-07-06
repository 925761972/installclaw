import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="footer">
      <div><Logo /><p>让字幕干净离场，让画面自然留下。</p></div>
      <p>© {new Date().getFullYear()} 净幕 · 请确保你拥有上传视频的处理授权</p>
    </footer>
  );
}
