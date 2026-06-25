import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "雀荘 成績集中管理PoC",
  description: "各卓の対局結果を本部画面に集約するPoC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
