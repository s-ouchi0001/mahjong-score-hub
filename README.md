# 雀荘向け 各卓成績集中管理PoC

各卓の点数データをAPIで受け取り、クラウドDBに保存し、本部ダッシュボード、店舗向け全ユーザ成績、プレイヤー本人の成績へ反映するMVPです。

## クラウド構成

推奨構成:

- アプリ: Vercel
- DB: Supabase PostgreSQL
- 各卓ゲートウェイ: 店舗内端末で起動し、クラウドAPIへPOST

```text
各卓ゲートウェイ
  -> https://your-app.vercel.app/api/table-events/point-update
  -> PostgreSQL
  -> 店舗画面 / プレイヤー画面
```

## 環境変数

`.env.example` を参考に、Vercel側に `DATABASE_URL`、`DIRECT_URL`、`AUTH_SECRET` を設定します。

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
AUTH_SECRET="replace-with-a-long-random-string"
```

Supabaseでは、アプリ実行用にPoolerの接続URLを `DATABASE_URL`、Prisma migrate用にDirect connectionのURLを `DIRECT_URL` に入れる構成が扱いやすいです。
`AUTH_SECRET` はログインCookieの署名に使います。Vercelでは長めのランダム文字列を設定してください。

## 初回DBセットアップ

Supabaseでプロジェクトを作成した後、手元またはCIから以下を実行します。

```bash
npm install
npm run db:migrate
npm run db:seed
```

## ローカル起動

ローカルでもPostgreSQLが必要です。`.env` の `DATABASE_URL` をローカルPostgreSQLかクラウドDBに向けてから起動します。

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

画面:

- 本部ダッシュボード: `http://localhost:3000/`
- 店舗向け全ユーザ成績: `http://localhost:3000/store/players`
- 各卓メンバー管理: `http://localhost:3000/tables/participants`
- 各卓成績入力: `http://localhost:3000/results`
- プレイヤー成績: `http://localhost:3000/players`
- ログイン: `http://localhost:3000/login`

## モックBluetoothゲートウェイ

Webアプリとは別プロセスのスクリプトです。後から実Bluetooth連携へ差し替えやすいよう、APIへPOSTするだけの構成にしています。

```bash
npm run mock:gateway -- --deviceId mock-table-1
npm run mock:gateway -- --deviceId mock-table-1 --intervalMs 5000
npm run mock:gateway -- --baseUrl https://your-app.vercel.app --deviceId mock-table-1
```

先に各卓メンバー管理画面で対象卓のメンバーを登録してください。

## 画像認識結果の取り込み

手入力確定に加えて、外部の画像認識サービスが読み取った最終点数をAPIへPOSTして確定できます。

```bash
npm run mock:ocr -- --baseUrl https://your-app.vercel.app --deviceId mock-table-1
```

API:

```text
POST /api/games/:gameId/recognized-result
```

Payload:

```json
{
  "provider": "score-image-ocr",
  "deviceId": "mock-table-1",
  "imageUrl": "https://example.com/scoreboard.jpg",
  "confidence": 0.94,
  "rawText": "34100 28500 22100 15300",
  "results": [
    { "playerId": "player-id-1", "points": 34100, "confidence": 0.98 },
    { "playerId": "player-id-2", "points": 28500, "confidence": 0.96 },
    { "playerId": "player-id-3", "points": 22100, "confidence": 0.93 },
    { "playerId": "player-id-4", "points": 15300, "confidence": 0.91 }
  ]
}
```

## API

- `POST /api/games/start`
- `POST /api/games/:gameId/finish`
- `POST /api/games/:gameId/recognized-result`
- `POST /api/table-events/point-update`
- `GET /api/tables`
- `GET /api/games`
- `GET /api/players`
- `GET /api/players/:playerId/stats`
