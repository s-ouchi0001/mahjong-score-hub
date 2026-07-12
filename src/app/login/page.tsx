import type { Metadata } from "next";
import { LoginForm } from "@/app/login/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ツモラ｜麻雀成績管理ツール",
  description: "ツモラは、麻雀の対局結果や個人成績を確認・管理できる麻雀成績管理ツールです。",
  alternates: {
    canonical: "https://mahjong.hsou-con.com/login",
  },
};

export default function LoginPage() {
  return (
    <main className="login-page player-login-page">
      <LoginForm
        role="PLAYER"
        title="ユーザログイン"
        description="自分の成績だけを確認できます。"
        identifierLabel="ユーザID"
      />
    </main>
  );
}
