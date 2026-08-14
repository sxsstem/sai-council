import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Council · 多模型合议核查",
  description: "多模型 + 证据对账的事实核查工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}