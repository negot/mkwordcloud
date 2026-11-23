# ビルド手順

対象: 承認つきデプロイスクリプト(`scripts/deploy/`)と、それが使う既存のビルド。実行はすべてプロジェクトのルートで行う。このステージでは AWS へのデプロイは実行しない。

## 前提

| 項目 | 内容 |
|---|---|
| Node | 20 以上(`package.json` の `engines`)。確認した版は、このステージの実行時の Node |
| 依存のインストール | `npm install`(`@vitest/coverage-v8` を含む。`package-lock.json` にある) |
| AWS CLI | デプロイ時に必要。ビルドとテストでは使わない |
| AWS の認証 | ビルドとテストでは不要。`cdk synth` は認証なしでも動く(下記の注意を参照) |

## 環境設定

| 変数 | 用途 | ビルドとテストでの扱い |
|---|---|---|
| `AWS_PROFILE` | デプロイ時に使う IAM Identity Center のプロファイル | 不要 |
| `WORDCLOUD_REGION` | デプロイ先のリージョン(既定 ap-northeast-1) | 不要(既定のまま) |
| `CDK_DEFAULT_ACCOUNT` | CDK が認証情報から設定する | 不要 |

## ビルドのコマンド

順に実行する。

| 順 | コマンド | 内容 | 期待する結果 |
|---|---|---|---|
| 1 | `npm run build:web` | 表示用 Web(`join` を含む)を `packages/web/dist` に作る | 終了コード 0。`main.js` と `join.js` ができる |
| 2 | `npm run build:extension` | 拡張機能を `dist/extension` と ZIP に作る | 終了コード 0 |
| 3 | `npm run typecheck` | 型検査(`tsc --noEmit`)。`scripts/deploy/` を含む | エラーなし |

まとめて実行するコマンド: `npm run build`(上の 1 から 3 を順に実行する)。

## ビルドの確認

- `packages/web/dist/join.html`、`join.js`、`join.css` があること。
- `dist/wordcloud-extension.zip` があること。
- 型検査のエラーが 0 件であること。

## IaC の静的確認(インフラのコード)

CDK のテンプレートを作れることを、AWS に接続せずに確認する。デプロイスクリプトと同じ保存先を使う(保存先は git 管理外で、スクリプトが実行のたびに削除して作り直す)。

```
npx cdk synth --app "npx tsx infra/bin/app.ts" --output cdk.out.deploy --quiet
```

- 期待する結果: 終了コード 0。Lambda 2 つのバンドル(`WsHandler`、`HttpHandler`)が完了する。
- 注意: AWS の認証情報の期限が切れていると「期限切れの認証情報があります。アカウント情報なしで生成します」という警告が出る。生成は成功する。デプロイの前には、IAM Identity Center にサインインし直す必要がある。
- 既存の `cdk.out/`(人のファイル)には書き込まない。

## 実行しないもの

- `cdk diff`、`cdk deploy`、AWS へのすべての呼び出し。認証情報と本番環境が必要で、実際のデプロイを行うステージ(Deployment Execution)が担当する。

## よくある問題

| 症状 | 原因と対処 |
|---|---|
| `build:web` が `esbuild` を見つけられない | `npm install` を実行する |
| `typecheck` が `scripts/deploy` で失敗する | `tsconfig.json` の `include` に `scripts/deploy/**` があるかを確認する |
| `cdk synth` が「期限切れの認証情報」と表示する | 生成は成功する。デプロイの前に、IAM Identity Center にサインインする |
| `cdk synth` が `packages/web/dist がありません` と警告する | 先に `npm run build:web` を実行する |

## Sources

- `package.json`、`tsconfig.json`、`vitest.config.ts`
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/code-generation/code-summary.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/infrastructure-design/cicd-pipeline.md`

## Assumptions & Open Questions

- Assumptions: ビルドとテストを実行する端末に、Node 20 以上と `npm install` 済みの依存がある。
- Open questions: None.
