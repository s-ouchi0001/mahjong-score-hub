import { LoginPanel } from "@/app/login/LoginPanel";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-hero">
        <div>
          <p className="login-kicker">Score Hub</p>
          <h1>雀荘 成績集中管理</h1>
          <p>店舗とプレイヤーの入口を分けて、必要な成績だけをすぐ確認できます。</p>
        </div>
      </section>
      <LoginPanel />
    </main>
  );
}
