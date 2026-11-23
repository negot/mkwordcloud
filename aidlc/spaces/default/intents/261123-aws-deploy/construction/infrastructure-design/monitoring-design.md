# 監視設計

`observability-design.md`(NFR Design)の方針を、プラットフォーム上の設定として具体化する。**アプリ本体の監視は新たに追加しない**。既存のダッシュボードとアラームは、そのまま使う(要件定義の Out of Scope)。デプロイの記録は、スクリプトの出力と承認ログが担う。

## Metrics & KPIs

既存のダッシュボード `wordcloud-workshop` が出している指標。変更しない。

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Lambda エラー数(1 分ごと) | `WsHandler`、`HttpHandler` の `Errors` | アラーム: 1 以上が 3 分連続 | デプロイ直後の不具合を見つける |
| Lambda 実行時間 p95 | `Duration` | 目標線 3000 ミリ秒 | 反映の遅さを見つける(目標: 95% が 3 秒以内) |
| Lambda 同時実行数 | `ConcurrentExecutions` | しきい値なし | 利用規模を見る |
| WebSocket の接続とメッセージ | `ConnectCount`、`MessageCount` | しきい値なし | 接続が張れているかを見る |
| WebSocket エラー | `ClientError`、`ExecutionError`、`IntegrationError` | しきい値なし | 接続の失敗を見る |
| HTTP API の 4xx、5xx | HTTP API の `4xx`、`5xx` | しきい値なし | API の失敗を見る |
| DynamoDB のスロットリング | `ThrottledRequests` | しきい値なし | 容量の問題を見る |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| `WsHandlerErrorAlarm` | `WsHandler` のエラーが 1 以上、3 分連続 | 中 | なし(通知先は設定されていない。ダッシュボードの「アラームの状態」で確認する) |
| `HttpHandlerErrorAlarm` | `HttpHandler` のエラーが 1 以上、3 分連続 | 中 | なし(同上) |

アラームの通知先(SNS など)は追加しない。デプロイ後は、人による確認(FR5.3、FR5.5)の際にダッシュボードを開いて確認できる。ダッシュボードの URL は `cdk-outputs.json` の `DashboardUrl` にある。

## SLIs / SLOs

アプリのサービスレベル目標(既存のダッシュボードの説明文にあるもの)。デプロイスクリプトの目安は `observability-design.md` による。

| SLI | SLO target | Measurement window |
|---|---|---|
| 送信の成功率 | 99% | 開催中の数時間 |
| 表示への反映時間 | 95% が 3 秒以内 | 開催中の数時間 |
| デプロイスクリプトの所要時間 | 15 分(目安。超えても失敗としない) | 1 回の実行 |

## Logs & Tracing

| 対象 | 設計 |
|---|---|
| Lambda のログ | CloudWatch Logs に 2 週間保管(既存のまま)。入力テキストは保存もログ出力もしない(NFR2.6) |
| デプロイの標準出力 | StepTimer が各ステップの結果と所要時間を表示する。認証情報は伏せ字にする |
| 承認ログ | `deploy-logs/approvals.jsonl`(JSON Lines、git 管理外)。`attemptId` で 1 回の実行を束ねる |
| CloudFormation のイベント | 失敗時に FailureReporter が取得して表示する(NFR5.7) |
| トレーシング | 追加しない |

## ダッシュボード

既存の `wordcloud-workshop` を使う。変更しない。デプロイスクリプトの結果を載せるダッシュボードは作らない。

## Sources

- `infra/lib/wordcloud-stack.ts`(CloudWatch の節)
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/observability-design.md`
- `infrastructure-design-questions.md`(Q5)

## Assumptions & Open Questions

- Assumptions: 既存のダッシュボードとアラームは、デプロイ後もそのまま有効である。
- Open questions: None.
