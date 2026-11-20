# デプロイ設定(CD)

根拠: `package.json` のスクリプト、`infra/`(AWS CDK)、Build and Test の結果。この作業には CI Pipeline と Infrastructure Design の成果物が無いため、それらは参照していません。[Q1]

## 方針

- 手動デプロイ・単一環境。担当者が手元から `npm run deploy` を実行する。実行した担当者が承認者を兼ねる。[Q1]
- CI/CD のサービス(GitHub Actions、CodePipeline)は使わない。[Q1]
- 機能フラグは使わない(対象外)。ワークショップ用の小さなアプリで、段階的な公開をしないため。

## 環境の昇格表

| 環境 | スタック名 | デプロイ方法 | 承認 | 備考 |
|------|------------|--------------|------|------|
| 本番相当(唯一の環境) | `WordcloudStack` | 手動 `npm run deploy` | 実行した担当者 | ワークショップの前日までにデプロイしてスモークテストを行う |

## 事前条件(初回のみ)

- AWS の認証情報(デプロイ権限のあるプロファイル)が、実行する端末に設定されている。
- 対象のアカウントとリージョン(既定は東京 `ap-northeast-1`。`WORDCLOUD_REGION` で変更)で、CDK のブートストラップが済んでいる: `npx cdk bootstrap --app "npx tsx infra/bin/app.ts"`。

## デプロイ手順

1. 作業ツリーがクリーンで、デプロイしたいコミットにいることを確認する。
2. 依存関係のインストール: `npm install`
3. ゲート(失敗したら中止する):
   - `npm test`(単体テスト。全件成功が条件)
   - `npm run build`(Web と拡張機能のバンドル、型チェック)
   - `npm run synth`(CDK テンプレートの生成)
4. デプロイ: `npm run deploy`
   - 内部で Web と拡張機能をビルドし、`cdk deploy --outputs-file cdk-outputs.json --require-approval never` を実行する。
   - IAM などの権限変更を確認したい場合は、`--require-approval never` を外して手動で実行する。
5. 出力の反映: `npm run apply-outputs`(`cdk-outputs.json` の ApiUrl と WsUrl で、配布用の拡張機能ZIPを作り直す)。
6. スモークテスト(`deployment-strategy.md` の「スモークテスト」)を実行する。
7. 成功したら、配布物を確定し、タグを付ける: `git tag deploy-YYYYMMDD-N`

## 生成物とバージョン管理

- 版の識別は Git のコミットとタグ(`deploy-YYYYMMDD-N`)で行う。コンテナイメージやレジストリは使わない。
- 拡張機能ZIP: `dist/wordcloud-extension.zip`(デプロイごとに作り直す。参加者へ配布するものは、最後にデプロイした版のZIPだけにする)。
- `cdk-outputs.json` は Git に含めない(`.gitignore` で除外済み)。

## ゲートと失敗時の扱い

| ゲート | コマンド | 失敗したら |
|--------|----------|------------|
| 単体テスト | `npm test` | デプロイしない。原因を直す |
| ビルド・型チェック | `npm run build` | デプロイしない。原因を直す |
| テンプレート生成 | `npm run synth` | デプロイしない。原因を直す |
| デプロイ | `npm run deploy` | CloudFormation が自動で元に戻す。出力のエラーを確認する |
| スモークテスト | `deployment-strategy.md` を参照 | `rollback-runbook.md` に従って戻す |
