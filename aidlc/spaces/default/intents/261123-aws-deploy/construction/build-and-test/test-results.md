# テスト結果

実行日時: 2026-11-23(UTC 12:20 ごろ)。Node v24.17.0、vitest 2.1.9。すべてプロジェクトのルートで実行した。AWS には接続していない。

## ビルド

| コマンド | 終了コード | 結果 |
|---|---|---|
| `npm run build`(`build:web`、`build:extension`、`typecheck`) | 0 | 成功。`packages/web/dist` に `main.js`(15.3 kB)と `join.js`(6.8 kB)、`dist/wordcloud-extension.zip` ができた。型検査のエラーは 0 件 |
| `npx cdk synth --app "npx tsx infra/bin/app.ts" --output cdk.out.deploy --quiet` | 0 | 成功。Lambda 2 つ(`WsHandler` 62.8 kB、`HttpHandler` 59.8 kB)をバンドルし、`WordcloudStack.template.json` ができた。「期限切れの AWS 認証情報」の警告が出たが、生成は成功した |

## 単体テストと結合テスト

| コマンド | 終了コード | ファイル | 件数 | 成功 | 失敗 | スキップ |
|---|---|---|---|---|---|---|
| `npx vitest run scripts/deploy --coverage`(単独実行) | 0 | 9 | 132 | 132 | 0 | 0 |
| `npm test`(既存を含む全体) | 0 | 19 | 224 | 224 | 0 | 0 |

- 結合テスト(`scripts/deploy/test/main.integration.test.ts`)は 21 件、すべて成功した。
- 既存のテスト(`packages/*`、`infra/test/stack.test.ts`)は、変更前と同じく、すべて成功した。モバイル入力フォームの `join-logic.test.ts`(13 件)も成功した。
- 二重に数えていない。`npm test` の 224 件には、`scripts/deploy` の 132 件が含まれる。

## カバレッジ(`scripts/deploy/src/**`)

しきい値(行 80%)は `vitest.config.ts` のまま。下げていない。

| 指標 | 値 |
|---|---|
| 行(Lines) | 97.94% |
| 文(Stmts) | 97.94% |
| 分岐(Branch) | 92.52% |
| 関数(Funcs) | 78.04% |

行カバレッジが低めのファイル: `main.ts` 95.09%(未到達は 253 から 255 行など、終了処理と、`/* v8 ignore */` で除外した直接実行のブロックの周辺)、`post-deploy.ts` 96.87%、`prompter.ts` 96%、`preflight.ts` 97.93%。それ以外は 100%。

## 静的な確認

| 確認 | 方法 | 結果 |
|---|---|---|
| `--require-approval never` が残っていない | `package.json`、`scripts/`、`infra/`、`docs/deploy.md` を検索 | 見つかったのは、使わないことを書いた文書とコメント、使っていないことを検証するテストだけ。実行する引数にはない |
| 承認ログとテンプレートの保存先が git 管理外 | `git check-ignore -v deploy-logs/approvals.jsonl cdk.out.deploy/manifest.json` | どちらも `.gitignore` の 41、42 行目に一致する |

## 失敗した項目

なし。

## 確認できていない項目(実環境が必要)

次は、AWS の認証情報と実環境が必要で、このステージでは実行できない。Deployment Execution が担当する。手順は `integration-test-instructions.md` にある。

- 実際の `cdk diff` の出力の形式での、DynamoDB と S3 の置換、削除の検出
- 保存したテンプレートでの `cdk deploy --app` の実行
- CDK の確認の表示と、拒否したときの判定(`Aborted by user`)
- 実際の自動確認(HTTP API の 404、表示用 Web の取得)と、人による確認
- 実際の所要時間(15 分の目安)

## 実行環境での注意

実行時に「期限切れの AWS 認証情報が環境にあります」という警告が出た。環境の AWS の認証情報が期限切れである。デプロイの前に、IAM Identity Center にサインインし直す必要がある。

## Sources

- `build-instructions.md`、`integration-test-instructions.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/code-generation/unit-test-instructions.md`、`code-summary.md`

## Assumptions & Open Questions

- Assumptions: 実行環境は、Code Generation と同じ端末である。
- Open questions: None.
