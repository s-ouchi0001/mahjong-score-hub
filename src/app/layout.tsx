import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "雀荘 成績管理クラウド",
  description: "雀荘のユーザ管理、卓管理、成績入力、プレイヤー成績閲覧をまとめて管理します。",
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
