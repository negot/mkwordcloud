# デプロイの記録

## 概要

| 項目 | 内容 |
|---|---|
| 対象 | `WordcloudStack`(本番、ap-northeast-1) |
| 方法 | 承認つきデプロイスクリプト `npm run deploy`(`scripts/deploy/`)。開発者の端末で実行 |
| 実行者 | `mz`(AWS: ロール `AWSReservedSSO_AdministratorAccess`、ユーザー `m-yamazaki`、アカウント `********8292`) |
| コミット | `680f4417ad3b60356396dd59e45a7532516a72ef` |
| 結果 | **成功**(スタックは `UPDATE_COMPLETE`) |
| 実行の開始と終了 | 2026-11-23 12:48:42 から 13:01:25(UTC)。スクリプト全体 12 分 43 秒(人の確認の待ち時間を含む) |
| デプロイに要した時間 | 約 1 分(デプロイ 1 分 2 秒。`cdk deploy` の出力では 41.98 秒) |
| 認証 | IAM Identity Center の一時的な認証(プロファイル `linked1`)。長期のアクセスキーは使っていない |

## 試行の経過

承認ログ(`deploy-logs/approvals.jsonl`、git 管理外)の `attemptId` ごとの記録。

| 試行 | 時刻(UTC) | 結果 | 理由 |
|---|---|---|---|
| 1 | 12:38:15 | 中止(事前確認) | 未コミットの変更があった(`aidlc/` と、当時は未追跡だった 2 ファイル)。コミットして `.gitignore` を更新し、解消した |
| 2 | 12:46:50 | 中止(事前確認) | AWS の認証の期限切れ(`ExpiredToken`)。この作業の環境に残っていた古い認証情報(`AWS_ACCESS_KEY_ID` など)が、IAM Identity Center より優先された |
| 3 | 12:48:28 | 中止(事前確認) | 同じ原因。環境変数を外さずに実行した |
| 4 | 12:48:42 | **成功** | `env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=linked1 npm run deploy` で、古い環境変数を外して実行した |

中止した 3 回は、すべて AWS を変更する前の事前確認で止まった。AWS 上の変更はない。

## 成功した試行(attemptId `20261123T124842Z-680f4417ad3b`)の段階

| 段階 | 結果 | 時間 |
|---|---|---|
| 事前確認(認証、ブートストラップ、スタックの状態、未コミットなし) | 成功 | 0 秒 |
| ビルドと検証(`build:web`、`build:extension`、型検査、テスト 224 件) | 成功 | 3 秒 |
| 再確認(ビルド後に追跡対象の変更なし) | 成功 | 0 秒 |
| テンプレート生成と差分 | 成功 | 23 秒 |
| 承認プロンプト | 承認(`yes`)。データ消失の警告はなく、確認は「尋ねていない」 | ― |
| ハッシュの再照合 | 一致(`3d18caeb...a4ee60`) | ― |
| デプロイ | 成功 | 1 分 2 秒 |
| 出力の反映(`apply-outputs`) | 成功。`dist/wordcloud-extension.zip` を作り直した | 0 秒 |
| 自動確認 | 成功(HTTP 404 と HTTP 200、再試行なし) | 1 秒 |
| 人による確認 | 3 項目とも「確認した」 | ― |

## デプロイされた変更

差分で変わったのは 1 件だけである。

- `Custom::CDKBucketDeployment`(`DeployWeb/CustomResource`)の `SourceObjectKeys`(表示用 Web の配置物の、zip のキーが 1 つ変わった)。これは、モバイル入力フォーム(`join.html`、`join.js`、`join.css`)を含む新しい Web の配置物を S3 に配置し、CloudFront を無効化する仕組みである。

DynamoDB と S3 の置換、削除はなく、データ消失の警告は出ていない。Lambda、API Gateway、CloudFront、アラーム、ダッシュボードの設定は、変更されていない。

## 反映された出力

| 出力 | 値 |
|---|---|
| WebUrl | `https://d1l71d169uog3u.cloudfront.net` |
| ApiUrl | `https://xq44axtoqf.execute-api.ap-northeast-1.amazonaws.com` |
| WsUrl | `wss://j7bpxg1uvk.execute-api.ap-northeast-1.amazonaws.com/prod` |
| ExtensionId | `bdakebdbelanamofgcgnjhdnkifbodpd`(既定値のまま) |
| モバイル入力ページ | `https://d1l71d169uog3u.cloudfront.net/join.html`(部屋コードを付けるときは `?room=部屋コード`) |

## ロールバックと復旧

ロールバックは行っていない(失敗なし)。手順は `docs/deploy.md` と `construction/infrastructure-design/cicd-pipeline.md` にある。

## 気づいた点(改善の候補)

- **古い環境変数が優先される。** 作業の環境に残る期限切れの `AWS_ACCESS_KEY_ID` などが、IAM Identity Center より優先され、試行 2 と 3 が中止した。スクリプトが、これらの環境変数を外して実行する(または、見つけたら警告して案内する)とよい。
- **`cdk diff` が、変更の一部を省略する。** 差分の出力に「非 ASCII の文字化けの可能性があるため、2 件の変更を省略した(`--strict` で表示)」とあった。リスク検出は、この出力を読むため、省略された変更にデータ消失を伴うものがあっても気づけない。`--strict` を付けるか、省略があったら警告する改良が望ましい。今回の 2 件は、日本語を含むダッシュボードやアラームの説明の変更と見られるが、確認していない。
- **変更の件数が 0 と記録された。** `start` 行の `changedResources` は、リスク検出の対象になった件数であり、差分の全体の件数ではない。実際の差分は 1 件だった。

## 承認ログのコミット

承認ログは git 管理外のため、コミットされない。実行の証拠は、この文書と、端末の出力、`deploy-logs/approvals.jsonl`(手元)に残る。

## ビルドとテストの結果の引用

デプロイの前提となった Build and Test の結果は、`aidlc/spaces/default/intents/261123-aws-deploy/construction/build-and-test/test-results.md`(テスト 224 件すべて成功、`scripts/deploy` の行カバレッジ 97.94%)である。デプロイ当日の実行(試行 4)でも、スクリプトの段階「ビルドと検証」で、同じ 224 件が成功した。実環境が必要だった確認(`integration-test-instructions.md` の「実環境で確認するもの」)の結果は、上の表のとおりである。

## Sources

- `deploy-logs/approvals.jsonl`(手元、git 管理外)
- 開発者が共有した端末の出力
- `cdk-outputs.json`(手元、git 管理外)
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/build-and-test/test-results.md`(build-test-results)

## Assumptions & Open Questions

- Assumptions: 省略された 2 件の変更は、ダッシュボードかアラームの日本語の説明である(未確認)。
- Open questions: 省略された変更を `--strict` で確認するか。
