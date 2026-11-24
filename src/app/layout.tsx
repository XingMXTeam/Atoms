import type { Metadata } from "next";
import "./globals.css";

const title = "Atoms Studio — 可验证的 AI 应用生成";
const description = "可验证的 AI 应用生成：需求 → 验收标准 → QA 评分与自修复";

export const metadata: Metadata = {
  metadataBase: new URL("https://atoms.maoxunxing.com"),
  title,
  description,
  applicationName: "Atoms Studio",
  openGraph: {
    title,
    description,
    siteName: "Atoms Studio",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
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
