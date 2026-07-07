import type { Metadata } from "next";
import "./globals.css";
import "./region-responsive.css";

export const metadata: Metadata = {
  title: "净幕｜视频号助手 - 微信视频号批量下载工具",
  description: "净幕视频号助手，一键下载微信视频号视频，支持批量下载、加密视频自动解密、智能去重。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
