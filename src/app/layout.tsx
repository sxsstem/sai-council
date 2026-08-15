/**
 * Sai Council · 多模型合议
 *
 * Copyright (c) 2026 小赛AI · Sai Council Contributors
 * Released under the MIT License.
 *
 * 小赛AI:青少年首个AI绿色引擎及创意社区。
 * https://github.com/your-org/council
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sai Council · 多模型合议核查",
  description: "多模型 + 证据对账的事实核查工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}