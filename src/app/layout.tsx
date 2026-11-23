import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atoms Studio — 可验证的 AI 应用生成",
  description: "可验证的 AI 应用生成：需求 → 验收标准 → QA 评分与自修复",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
