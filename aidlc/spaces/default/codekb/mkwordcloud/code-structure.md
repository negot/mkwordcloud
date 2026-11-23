# Code Structure

## Layout
| Path | 分類 | 内容 |
|------|------|------|
| packages/core/src/ | Utility / Model | protocol.ts(メッセージ型・エラー文言)、constants.ts、room.ts(コード生成・ホストキー、node:crypto)、sanitize.ts、rate.ts(純粋関数)、tokenizer.ts(kuromoji)、stopwords.ts、index.ts |
| packages/server/src/service.ts | Service / Controller | REST・WS のハンドラー本体(`handleRest`、`handleWsConnect`、`handleWsMessage`、`broadcast`) |
| packages/server/src/{dynamo,memory}-repository.ts, repository.ts | Repository | 永続化の抽象と実装(DynamoDB 単一テーブル、メモリ) |
| packages/server/src/apigw-pusher.ts | Service | API Gateway Management API で push(切断済みは false) |
| packages/server/src/lambda/{http,ws}.ts | Controller / Config | Lambda エントリ |
| packages/server/src/local.ts | Configuration | ローカル開発サーバー(静的配信 + REST + ws) |
| packages/web/src/main.ts | Controller | 表示画面(viewer)の画面遷移、状態 `words`、描画の間引き |
| packages/web/src/{logic,cloud,socket,api}.ts | Utility / Service | 語の統合・上位 N・フォント計算、d3-cloud 描画、再接続 WebSocket、REST 呼び出し |
| packages/web/src/join*.{ts,html,css} | Controller / Utility / Static | モバイル入力フォーム(join.ts、純粋ロジックは join-logic.ts) |
| packages/web/src/{index.html,styles.css} | Static | 表示画面の HTML/CSS |
| packages/extension/src/ | Controller / Static | popup.ts、protocol.ts、popup.html、popup.css(未再読、旧記録のまま) |
| infra/lib/ | Configuration | wordcloud-stack.ts(CDK スタック)、config.ts |
| scripts/ | Configuration | build-web.mjs(main.ts と join.ts を別々に bundle)、build-extension.mjs、apply-outputs.mjs、load-test.mjs、deploy/(承認つきデプロイ。src 16 ファイル) |
| */test/, infra/test/, scripts/deploy/test/ | Test | vitest |
| docs/ | Static | deploy.md、主催者/参加者ガイド(HTML) |

## Patterns
- ブラウザコードは `@wordcloud/core/protocol` と `/constants` のサブパスを import する(core のルートは node:crypto を含む)。
- UI は素の DOM + `data-testid` 属性。ES モジュールを esbuild で 1 ファイルにバンドルする(viewer は main.js、モバイル入力は join.js)。
- 画面ロジックは「純粋関数(logic.ts、join-logic.ts)+ DOM を触る薄い main.ts / join.ts」に分け、純粋関数側だけにテストがある。
- サーバーは `Deps`(repo、pusher、tokenize、now、allowedOrigins)を注入する形で、テストは MemoryRepository と SpyPusher で動く。
- コメントとメッセージは日本語。要件 ID(FR/NFR)をコメントで参照する。
