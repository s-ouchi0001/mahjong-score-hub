# PC点数認識ツール

Androidアプリで作った「席1〜4の認識範囲」「中央正方形切り取り」「Web APIへの点数送信」を、ミニPC / Windows / Mac で動かすためのPC版です。

Webカメラでも、Tapo C120のRTSP映像でも同じプログラムで扱えます。

## できること

- WebカメラまたはRTSPカメラから映像を取得
- 画角中央を正方形に切り取り
- 席1〜4の点数パネル範囲を%指定
- プレビュー上に認識範囲と対角線ガイドを表示
- 赤い7セグ点数表示を軽量認識
- 点数パネル内に複数の数字がある場合、卓の外側に一番近い数字をその席の点数として採用
- 同じ点数が複数回続いたときだけ安定値として採用
- `GET /api/android/table` で卓情報を取得
- `POST /api/android/point-update` で点数をWebアプリへ送信
- 小さな確認用画像をWebアプリへ送信
- 送信時の画像を学習データ候補として保存

## 初回準備

Mac / Windows のどちらでも、Pythonを入れてから実行します。

```bash
cd "/Users/user/Documents/麻雀採点収集機能"
python3 -m venv .venv-score
source .venv-score/bin/activate
pip install -r pc-score-recognizer/requirements.txt
```

Windowsでは `source ...` の代わりに次を使います。

```bat
.venv-score\Scripts\activate
```

## 設定

まず送信先と端末IDを保存します。

```bash
npm run pc:setup -- --baseUrl http://127.0.0.1:3000 --deviceId mock-table-1
```

Webカメラの場合:

```json
"camera": 0
```

Tapo C120の場合:

```bash
npm run pc:setup -- --baseUrl http://127.0.0.1:3000 --deviceId mock-table-1 --camera "rtsp://カメラ用ユーザー名:カメラ用パスワード@192.168.1.50/stream1"
```

`baseUrl` は送信先のWebアプリです。`deviceId` はWebアプリの卓管理画面にある「カメラ端末ID」と同じ値にします。

ローカル開発:

```json
"baseUrl": "http://127.0.0.1:3000"
```

本番:

```json
"baseUrl": "https://mahjong.hsou-con.com"
```

## 起動

先にWebアプリを起動しておきます。

```bash
npm run dev
```

別のターミナルでPC認識を起動します。

```bash
npm run pc:recognizer
```

終了するときは、プレビュー画面を選んで `q` を押します。

## 認識範囲

`regions` の `centerX / centerY / width / height` は、Androidアプリと同じく正方形画角内の%指定です。

```json
{ "seat": 1, "centerX": 50, "centerY": 4, "width": 28, "height": 8, "rotate": 180 }
```

- `centerX`: 横位置
- `centerY`: 縦位置
- `width`: 横幅
- `height`: 高さ
- `rotate`: その範囲だけ何度回転して読むか

上から時計回りに席1〜4の場合、初期値は以下です。

```text
席1: 上側中央
席2: 右側中央
席3: 下側中央
席4: 左側中央
```

実際の卓で、黒い点数パネル全体が四角の中に入るように調整してください。

点数パネル内に複数の赤い数字がある場合は、以下のルールで席の点数を選びます。

```text
席1: 上側パネルの中で一番上の数字
席2: 右側パネルの中で一番右の数字
席3: 下側パネルの中で一番下の数字
席4: 左側パネルの中で一番左の数字
```

数字の向きは各席の中央に向かっている前提なので、`rotate` で席ごとに読み取り向きを合わせます。

## 注意

最初の認識方式は、赤い7セグ表示を軽く読むためのものです。
実卓の明るさ、カメラ角度、点数表示のにじみで調整が必要になります。

まずは「プレビューで四角が点数表示に合っているか」「送信画像が保存されるか」を確認してください。
