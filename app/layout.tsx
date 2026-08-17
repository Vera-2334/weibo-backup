import type { Metadata } from "next";
import { Outfit, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-serif-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Weibo Backup",
  description: "微博备份工具 — 把你的微博完整备份到本地",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  referrer: "no-referrer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={`${outfit.variable} ${notoSansSC.variable} ${notoSerifSC.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}