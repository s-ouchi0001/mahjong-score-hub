import { LoginForm } from "@/app/login/LoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="login-page admin-login-page">
      <section className="login-hero">
        <div>
          <p className="login-kicker">Score Hub Admin</p>
          <h1>管理者ログイン</h1>
          <p>店舗のユーザ管理、入退場管理、成績確認を行う管理者向け画面です。</p>
        </div>
      </section>
      <LoginForm
        role="STORE_ADMIN"
        title="管理者アカウント"
        description="管理者メールアドレスとパスワードでログインしてください。"
        defaultEmail="owner@example.com"
      />
    </main>
  );
}
