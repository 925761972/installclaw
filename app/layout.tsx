import type { Metadata } from "next";
import "./globals.css";
import "./region-responsive.css";

export const metadata: Metadata = {
  title: "净幕｜AI 字幕擦除",
  description: "标准版与精细化 AI 视频字幕擦除，按实际时长计费。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
