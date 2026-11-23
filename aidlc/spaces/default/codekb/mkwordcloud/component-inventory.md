# Component Inventory

## core
- 責務: 共有型/定数(`ServerMessage`、`ClientMessage`、`TOP_WORDS` など)、ルームコードとホストキー、サニタイズと文字数検証、レート判定(純粋関数)、語分割(kuromoji、ストップワード)。
- 依存: kuromoji。room.ts は node:crypto を使う(ブラウザは `protocol` と `constants` の subpath のみ利用)。
- 主なテスト: sanitize、tokenizer、room-rate。

## server
- 責務: REST/WS ロジック(service.ts)、DynamoDB/メモリ リポジトリ、API Gateway への push、Lambda エントリ(ws.ts は kuromoji を持ち、http.ts は持たない)、ローカル開発サーバー(local.ts)。
- 保存するもの: ROOM#/META、WORD#、VIEWER#、CONN#/META、RATE#(いずれも ttl 付き)。入力テキストを保存する項目は無い。
- 依存: core、AWS SDK v3、ws。
- 主なテスト: service(WS の投稿・拒否・主催者操作)、api(REST と local サーバー)、repository(Memory と Dynamo モック)。

## web
- 責務: 主催者の表示画面。ルーム作成、viewer として接続、`words` 状態の保持、d3-cloud による描画、リセット/終了。加えてスマートフォン向けの入力フォーム(join.html / join.ts / join-logic.ts)。
- 主要モジュール: main.ts(画面遷移と状態)、logic.ts(`mergeWords`、`topWords`、`fontSize`、`parseConfig`、`buildViewerWsUrl`、`backoffDelay`)、cloud.ts(`renderCloud`、`drawPlaced`)、socket.ts(`ReconnectingSocket`)、api.ts(ルーム REST)。
- 依存: core(subpath)、d3-cloud、extension の protocol.ts(join-logic.ts が再利用)。
- 主なテスト: logic.test.ts、join-logic.test.ts。描画・socket・main のテストは無い。

## extension
- 責務: 参加者の送信ポップアップ(Chrome MV3)。participant 役で接続する。clientId と最終ルームを chrome.storage.local に保存。protocol.ts の通信ヘルパーは web の join が共用する。
- 依存: core(subpath)。(今回は再走査していない)

## infra
- 責務: CDK スタック(S3/CloudFront と CSP、HTTP/WS API とスロットル、Lambda 2 本、DynamoDB、14 日保持のロググループ、CloudWatch ダッシュボード/アラーム)。ws Lambda は 1024MB/10 秒、http Lambda は 256MB/5 秒。
- 依存: aws-cdk-lib、web の dist。

## scripts
- 責務: web/extension のビルド、CDK 出力の適用、負荷試験、承認つきデプロイ(scripts/deploy)。build-web.mjs 以外は今回は概観のみ。
