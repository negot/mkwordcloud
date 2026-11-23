# Code Structure

## Layout
| Path | 分類 | 内容 |
|------|------|------|
| packages/core/src/ | Utility / Model | protocol.ts(メッセージ型・エラー文言)、constants.ts、room.ts(コード生成・ホストキー)、sanitize.ts、rate.ts、tokenizer.ts、stopwords.ts |
| packages/server/src/service.ts | Service / Controller | REST・WS のハンドラー本体 |
| packages/server/src/{dynamo,memory}-repository.ts, repository.ts | Repository | 永続化の抽象と実装 |
| packages/server/src/lambda/{http,ws}.ts | Controller / Config | Lambda エントリ |
| packages/server/src/local.ts | Configuration | ローカル開発サーバー(静的配信 + REST + ws) |
| packages/web/src/ | Static / Controller | 表示画面(main.ts, cloud.ts, socket.ts, api.ts, logic.ts, index.html, styles.css) |
| packages/extension/src/ | Controller / Static | popup.ts, protocol.ts, popup.html, popup.css |
| infra/ | Configuration | CDK スタック(wordcloud-stack.ts) |
| scripts/ | Configuration | build-web.mjs, build-extension.mjs, apply-outputs.mjs, load-test.mjs |
| */test/, infra/test/ | Test | vitest |
| docs/ | Static | 主催者/参加者ガイド(HTML) |

## Patterns
- ブラウザコードは `@wordcloud/core/protocol` と `/constants` のサブパスを import する(core のルートは node:crypto を含む)。
- UI は素の DOM + `data-testid` 属性。ES モジュールを esbuild で 1 ファイルにバンドルする。
- コメントとメッセージは日本語。要件 ID(FR/NFR)をコメントで参照する。
