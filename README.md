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

## Androidタブレット点数ゲートウェイ

Androidタブレットで麻雀卓を常時撮影し、認識した現在点数をWebへ送るためのAPIです。
Android側はプレイヤーIDや氏名を持たず、店舗IDと卓番号、席順の点数だけで進行中の対局へ反映できます。

```text
Androidタブレット
  -> GET /api/android/table?deviceId=mock-table-1
  -> 自分の店舗、卓番号、席1〜4の現在点数を取得
  -> POST /api/android/point-update
  -> 進行中の対局の席順へ点数を反映
  -> 本部ダッシュボードで現在点数を確認
```

任意で `ANDROID_GATEWAY_API_KEY` を設定すると、Android側から `Authorization: Bearer <key>` または `x-api-key: <key>` を付けたリクエストだけ受け付けます。
未設定の場合は、開発用として認証なしで受け付けます。

卓情報取得:

```text
GET /api/android/table?deviceId=mock-table-1
```

Response:

```json
{
  "store": {
    "id": "store-demo",
    "name": "本部デモ店舗"
  },
  "table": {
    "id": "table-id",
    "tableNumber": 1,
    "deviceId": "mock-table-1",
    "status": "PLAYING",
    "connectionStatus": "ONLINE",
    "lastSeenAt": "2026-06-27T12:00:00.000Z"
  },
  "activeGame": {
    "id": "game-id",
    "startedAt": "2026-06-27T11:30:00.000Z",
    "seatPoints": [
      { "seat": 1, "points": 25000 },
      { "seat": 2, "points": 25000 },
      { "seat": 3, "points": 25000 },
      { "seat": 4, "points": 25000 }
    ]
  }
}
```

進行中の対局がない場合、`activeGame` は `null` になります。

点数送信:

```text
POST /api/android/point-update
```

Payload:

```json
{
  "storeId": "store-demo",
  "tableNumber": 1,
  "deviceId": "mock-table-1",
  "capturedAt": "2026-06-27T12:00:00.000Z",
  "recognition": {
    "provider": "android-camera-ocr",
    "confidence": 0.92
  },
  "points": [34100, 28500, 22100, 15300]
}
```

`points` は席1、席2、席3、席4の順です。次の形式でも送信できます。

```json
{
  "storeId": "store-demo",
  "tableNumber": 1,
  "points": [
    { "seat": 1, "points": 34100 },
    { "seat": 2, "points": 28500 },
    { "seat": 3, "points": 22100 },
    { "seat": 4, "points": 15300 }
  ]
}
```

ローカルでAndroid送信を疑似実行する場合:

```bash
npm run mock:android -- --deviceId mock-table-1
npm run mock:android -- --deviceId mock-table-1 --intervalMs 5000
npm run mock:android -- --baseUrl https://your-app.vercel.app --deviceId mock-table-1 --apiKey your-key
```

先に各卓メンバー管理画面で対象卓の4席を登録してください。進行中の対局がない場合も通信状態と点数スナップショットは保存されますが、プレイヤー成績には反映されません。

Androidの手入力MVPアプリは `android-tablet-gateway` にあります。
Android Studioで `/Users/user/Documents/麻雀採点収集機能/android-tablet-gateway` を開いて実行してください。
本部ダッシュボードは自動更新されるため、Androidから点数を送信すると数秒後に画面へ反映されます。

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
- `GET /api/android/table`
- `POST /api/android/point-update`
- `POST /api/table-events/point-update`
- `GET /api/tables`
- `GET /api/games`
- `GET /api/players`
- `GET /api/players/:playerId/stats`
