import type { Metadata } from "next";
import "./globals.css";
import "./region-responsive.css";

export const metadata: Metadata = {
  title: "净幕｜AI 字幕擦除｜铭锦澜泽",
  description: "标准版与精细化 AI 视频字幕擦除，按实际时长计费。",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16" },
      { url: "/favicon-32x32.png", sizes: "32x32" },
      { url: "/favicon-48x48.png", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/favicon-128x128.png", sizes: "128x128" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
