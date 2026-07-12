import type { Metadata } from "next";
import "./globals.css";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL("https://mahjong.hsou-con.com"),
  title: {
    default: "ツモラ｜麻雀成績管理ツール",
    template: "%s｜ツモラ",
  },
  description: "ツモラは、麻雀の対局結果や個人成績を確認・管理できる麻雀成績管理ツールです。",
  verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
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
