# デプロイ記録(入力データ一覧欄)

| 項目 | 内容 |
|---|---|
| 日時 | 2026-11-23 13:55 から 13:58(UTC) |
| コミット | 880f4ec(main) "Add input list panel with 24h stored entries" |
| 実行者 | mz(自分の端末。承認つきデプロイスクリプト) |
| 実行コマンド | `env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=linked1 npm run deploy` |
| 対象 | スタック WordcloudStack、ap-northeast-1、アカウント下4桁 8292 |
| attemptId | 20261123T135559Z-880f4ec42763 |
| 承認 | approved(承認したハッシュと、デプロイ直前のハッシュが一致) |
| データ消失の警告 | 出なかった(dataLossAnswer: not-asked)。DynamoDB と S3 の置き換え・削除なし |
| 結果 | 成功(終了コード 0、CDK の拒否なし) |
| 変更範囲 | `infra/` は変更なし。Lambda のコードと web の配布物の更新 |

承認の記録: `deploy-logs/approvals.jsonl`(git 管理外)。

## ロールバック
前のコミット(680f441)に戻して、同じスクリプトで再デプロイする。入力の一覧のデータは使い捨てで、24 時間で消える。DynamoDB の項目の種類が増えただけで、旧版のコードは新しい種類の項目を読まないため、戻しても害はない。
