import type { Metadata } from "next";
import Link from "next/link";

const serviceTitle = "ツモラ｜麻雀成績管理ツール";
const serviceDescription = "ツモラは、麻雀の対局結果や個人成績を確認・管理できる麻雀成績管理ツールです。";

export const metadata: Metadata = {
  title: serviceTitle,
  description: serviceDescription,
  alternates: {
    canonical: "https://mahjong.hsou-con.com/",
  },
  openGraph: {
    title: serviceTitle,
    description: serviceDescription,
    url: "https://mahjong.hsou-con.com/",
    siteName: "ツモラ",
    locale: "ja_JP",
    type: "website",
  },
};

export default function PublicHomePage() {
  return (
    <main className="public-page">
      <header className="public-header">
        <Link href="/" className="public-brand" aria-label="ツモラ トップ">
          ツモラ
        </Link>
        <nav className="public-nav" aria-label="公開ページ">
          <Link href="/login">ログイン</Link>
        </nav>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="public-kicker">麻雀成績管理ツール</p>
          <h1>ツモラ</h1>
          <p>
            ツモラは、麻雀の対局結果や個人成績を確認・管理できる麻雀成績管理ツールです。
            雀荘の成績入力、ユーザ管理、ランキング確認までをひとつの画面で扱えます。
          </p>
          <div className="public-actions">
            <Link href="/login" className="public-primary-link">
              ログインへ
            </Link>
          </div>
        </div>
        <div className="public-visual" aria-hidden="true">
          <div className="public-score-panel">
            <span>本日の成績</span>
            <strong>+42.8</strong>
            <small>トップ率 38.5%</small>
          </div>
          <div className="public-score-list">
            <span>1位 佐藤</span>
            <span>2位 鈴木</span>
            <span>3位 高橋</span>
            <span>4位 田中</span>
          </div>
        </div>
      </section>

      <section className="public-feature-band" aria-label="主な機能">
        <div>
          <strong>対局結果管理</strong>
          <span>半荘ごとの点数・順位・スコアを記録</span>
        </div>
        <div>
          <strong>個人成績確認</strong>
          <span>通算、直近、大会別の成績を表示</span>
        </div>
        <div>
          <strong>店舗運用</strong>
          <span>ユーザ、卓、ランキングを店舗単位で管理</span>
        </div>
      </section>
    </main>
  );
}
