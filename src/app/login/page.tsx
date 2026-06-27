import { LoginForm } from "@/app/login/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="login-page player-login-page">
      <LoginForm
        role="PLAYER"
        title="ユーザログイン"
        description="自分の成績だけを確認できます。"
        defaultEmail="player1@store-demo.example.com"
      />
    </main>
  );
}
