# ヘルスチェックの報告

デプロイの完了後(2026-11-23 13:0x UTC ごろ)に、読み取りだけで確認した。

## スタックの状態

| 確認 | 結果 |
|---|---|
| `WordcloudStack` の状態 | `UPDATE_COMPLETE`(最終更新 2026-11-23 12:49:39 UTC) |
| ロールバックや失敗したリソース | なし |

## アラーム(CloudWatch)

| アラーム | 状態 |
|---|---|
| `WordcloudStack-HttpHandlerErrorAlarm...`(Lambda `HttpHandler` のエラー) | OK |
| `WordcloudStack-WsHandlerErrorAlarm...`(Lambda `WsHandler` のエラー) | OK |

どちらも、しきい値(エラー 1 以上が 3 分連続)に達していない。

## 配信の状態

| 確認 | 結果 |
|---|---|
| 表示用 Web | HTTP 200 |
| モバイル入力ページ(`join.html`、`join.js`) | HTTP 200 |
| `config.json`(API と WebSocket の接続先) | HTTP 200 |

## 変更の影響

差分は、表示用 Web の配置物の 1 件だけだった。DynamoDB、S3、Lambda、API Gateway、CloudFront、アラーム、ダッシュボードの設定は変更されていない。そのため、データへの影響はない。

## 監視の確認の続き

- 開催中の数時間の成功率(目標 99%)と反映時間(95% が 3 秒以内)は、デプロイの直後には測れない。実際に使うときに、ダッシュボード `wordcloud-workshop` で確認できる。次のステージ(Observability Setup)で扱う。
- ダッシュボード: `https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=wordcloud-workshop`

## 総合

デプロイ直後の状態は、正常である。

## Sources

- `aws cloudformation describe-stacks`、`aws cloudwatch describe-alarms`(読み取りだけ)
- `curl` による HTTP ステータスの確認

## Assumptions & Open Questions

- Assumptions: アラームの `OK` は、デプロイ直後の短い期間の状態である。
- Open questions: None.
