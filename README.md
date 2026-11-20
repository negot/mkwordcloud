# リアルタイム・ワードクラウド

100人規模のワークショップで、参加者が Chrome 拡張機能から単語・短文を送ると、会場に映した Web ページのワードクラウドがリアルタイムに更新される仕組みです。

- 参加者: Chrome 拡張機能でルームコードを入力し、テキストを送るだけ(送信専用)。
- 主催者・会場: Web ページでルームを作成し、ワードクラウドを投影します。リセット・終了もできます。
- 構成: CloudFront + S3(表示ページ)/ API Gateway(HTTP と WebSocket)+ Lambda / DynamoDB。AWS CDK(TypeScript)で1コマンドでデプロイできます。

```
packages/core       純粋ロジック(サニタイズ、語分割、レート制限、ルームコード)
packages/server     サーバー(データ層、サービス層、Lambda、ローカルサーバー)
packages/web        表示ページと主催者画面(d3-cloud、SVG)
packages/extension  Chrome 拡張機能(Manifest V3)
infra               AWS CDK
scripts             ビルド、設定反映、負荷試験
```

## 必要なもの

- Node.js 20 以上、npm
- Google Chrome
- AWS にデプロイする場合: AWS アカウントと認証情報、`cdk bootstrap` 済みのリージョン

## ローカルで動かす

```bash
npm install
npm run dev
```

1. ブラウザで <http://localhost:3000> を開き、「ルームを作成」を押します。ルームコードと主催者キーが表示されます。
2. 「表示を開始」を押すと、ワードクラウドの画面になります(`#/room/<ルームコード>`)。
3. 拡張機能を読み込みます(下の「拡張機能の読み込み」)。
4. 拡張機能のポップアップにルームコードを入力して「参加」し、テキストを送信すると、ワードクラウドが更新されます。

ローカルサーバーはメモリ上にデータを持ちます。止めるとデータは消えます。ポートは環境変数 `PORT`(既定 3000)で変えられます。

### 拡張機能の読み込み

```bash
npm run build:extension      # dist/extension と dist/wordcloud-extension.zip を作ります
```

1. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにします。
2. 「パッケージ化されていない拡張機能を読み込む」を押し、`dist/extension` を選びます。
3. ツールバーの拡張機能アイコンから「ワードクラウド送信」を開きます。

`npm run build:extension` は、既定でローカルサーバー(`http://localhost:3000`)に接続する設定を作ります。

## テスト・型チェック・ビルド

```bash
npx vitest run packages/core packages/server packages/web packages/extension infra   # = npm test
npm run typecheck
npm run build        # Web と拡張機能のビルド + 型チェック
```

テストに AWS の認証情報は要りません。

## AWS にデプロイする

```bash
npx cdk bootstrap            # アカウント・リージョンごとに初回のみ
npm run deploy               # Web と拡張機能をビルドし、cdk deploy を実行します
npm run apply-outputs        # デプロイ出力(cdk-outputs.json)を拡張機能の設定に反映し、再ビルド・ZIP化します
```

- リージョンは環境変数 `WORDCLOUD_REGION`(未設定なら `ap-northeast-1`、東京)に従います。AWS CLI の既定リージョンには従いません。別のリージョンにデプロイする場合は、`cdk bootstrap` もそのリージョンで行ってください(例: `WORDCLOUD_REGION=us-east-1 npx cdk bootstrap`)。
- デプロイの出力: `WebUrl`(表示ページ)、`ApiUrl`(REST API)、`WsUrl`(WebSocket)、`ExtensionId`。
- 表示ページには、`ApiUrl` と `WsUrl` を入れた `config.json` が自動で配置されます。
- `npm run apply-outputs` が `dist/wordcloud-extension.zip` を作り直します。これを参加者に配布してください。
- 拡張機能 ID は `packages/extension/manifest.json` の `key` で固定しています(`packages/extension/EXTENSION_ID`)。CORS と WebSocket の許可 Origin に使われます。別の ID を使う場合は `npx cdk deploy -c extensionId=<ID>` とします。
- 注意: CloudFront の既定の証明書では、TLS の最低バージョンを指定できません(独自ドメインは使わない方針です)。通信は常に HTTPS/WSS で、HTTP は HTTPS へリダイレクトされます。

### 参加者向けの手順(ZIP 配布)

1. 配布された `wordcloud-extension.zip` を、任意の場所に展開します(展開したフォルダは削除しないでください)。
2. Chrome で `chrome://extensions` を開き、「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」で、展開したフォルダを選びます。
4. 拡張機能のアイコンを開き、主催者から伝えられたルームコードを入力して「参加」を押します。
5. テキスト(100文字まで)を入力して送信します。1秒に1回、1分に20回までです。

### 削除

```bash
npx cdk destroy
```

S3 の中身、DynamoDB のテーブルを含め、すべて削除されます。

## 主催者の操作

- 「ルームを作成」: ルームコードと主催者キーが表示されます。主催者キーはこの端末(ブラウザの localStorage)にだけ保存されます。
- 表示画面の「リセット」: 集計を 0 にします。「終了」: ルームの全データを即時に削除します。どちらも主催者キーが保存された端末にだけボタンが出ます。
- 主催者キーが分からなくなった場合、リセット・終了はできません。ルームは作成から24時間後に自動で削除されます。

## セキュリティと運用メモ

- 通信はすべて HTTPS/WSS です(ローカル開発を除く)。
- Origin による制限(REST の CORS と WebSocket の接続)は、ブラウザからのアクセスに対してのみ信頼できます。ブラウザ以外のクライアントは Origin を偽れるため、この制限は不正利用の防止策ではなく、他サイトのページからの利用を防ぐ策です。ルームコードを知らない人が参加できない点は、ルームコードの推測されにくさ(8文字、約 10^12 通り)と API のスロットリングで守っています。
- ルーム作成は誰でもできます。API Gateway のスロットリング(HTTP: 毎秒 20 / バースト 40、WebSocket: 毎秒 100 / バースト 200)で保護しています。
- 主催者キーは 24 バイトのランダム値で、サーバーにはハッシュ(SHA-256)だけを保存します。ログには出力しません。
- 入力テキストは保存もログ出力もしません。保存するのは語ごとの出現回数だけです。表示側は語を `textContent` で描画し、HTML として解釈しません。
- データは作成から 24 時間で DynamoDB の TTL により削除されます(TTL の削除は遅れることがあるため、読み取り時にも期限を確認します)。ログの保持は 14 日です。
- レート制限は、拡張機能が作る匿名のランダム値(`clientId`)ごとに数えます。個人を特定する情報は保存しません。
- Lambda と DynamoDB の権限は、必要な操作だけに絞っています。
- Lambda のランタイムは Node.js 20 です。AWS Lambda での Node.js 20 は非推奨期間に入っているため、将来は `nodejs22.x` 以降への更新を検討してください(`infra/lib/wordcloud-stack.ts`)。
- 初回リクエストでは、日本語辞書の読み込みに 1〜2 秒かかります(コールドスタート)。ワークショップの直前に一度、テスト送信しておくと待たされません。
- 表示ページは、WebSocket の接続後に `sync` を送って現在の集計を受け取ります(API Gateway では `$connect` の応答前に接続へ送信できないため)。

### コストの目安

サーバーレス構成で、常時稼働のサーバーはありません。100人・数時間のワークショップ1回で、Lambda、DynamoDB(オンデマンド)、API Gateway、CloudFront の合計が、通常は数ドルに収まる見込みです(実測はしていません)。使わない間の費用は、ほぼ S3 とログの保管料だけです。不要になったら `cdk destroy` で削除してください。

## 負荷試験

100クライアントが数秒に1回送信し、表示側が受け取る反映遅延(p95)を測ります。

```bash
# ローカルサーバーを起動してから
node scripts/load-test.mjs --clients 100 --duration 20

# AWS に対して(デプロイ出力の値を使います)
node scripts/load-test.mjs --api <ApiUrl> --ws <WsUrl> --origin <WebUrl> --clients 100 --duration 60
```

- `--interval`(既定 3500ms)は、各クライアントの送信間隔です。1分に20回の上限を超えないようにしてください。
- AWS に対して実行すると、リクエストが課金対象になります。また、API のスロットリング(HTTP は毎秒 20)に影響されます。ルーム作成は 1 回だけです。
- 合格の目安: 反映遅延 p95 が 3 秒以内で、取りこぼしが 0 件。

## 仕様の対応表

要件との対応は `aidlc/spaces/default/intents/261120-realtime-wordcloud/construction/code-generation/traceability.json` にあります。
