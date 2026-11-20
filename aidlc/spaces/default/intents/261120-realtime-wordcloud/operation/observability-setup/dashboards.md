# ダッシュボード

決定: CDK で CloudWatch ダッシュボードを1枚作る。[Q2]

- 名前: `wordcloud-workshop`(東京リージョン)。CDK の出力 `DashboardUrl` から開ける。
- 定義: `infra/lib/wordcloud-stack.ts`(「ダッシュボード」の部分)。テスト: `infra/test/stack.test.ts`。
- 既定の表示期間: 3時間(ワークショップ1回分)。
- 反映には再デプロイ(`npm run deploy`)が必要。

## 配置

| 行 | ウィジェット | 指標 | 見るポイント |
|----|--------------|------|--------------|
| 1 | 説明 | - | 目標(送信の99%が成功、95%が3秒以内に反映) |
| 2 | Lambda エラー数 | `WsHandler`、`HttpHandler` の Errors(1分の合計) | 0 であること |
| 2 | Lambda 実行時間 p95 | 2つの Lambda の Duration p95。3秒の目標線つき | 目標線より十分下であること。初回のみ辞書の読み込みで跳ねる |
| 2 | Lambda 同時実行数 | ConcurrentExecutions(最大) | アカウントの上限(既定1,000)に対して余裕があること |
| 3 | WebSocket 接続とメッセージ | ConnectCount、MessageCount(1分の合計) | 参加人数と送信の量の目安 |
| 3 | WebSocket エラー | ClientError(スロットリングを含む)、ExecutionError、IntegrationError | ClientError が増えたら、レート制限か API のスロットリング |
| 3 | HTTP API 4xx / 5xx | 4xx、5xx(1分の合計) | 5xx は 0 であること。4xx はルームコード違いなどでも増える |
| 4 | DynamoDB スロットリング | GetItem、PutItem、UpdateItem、Query の ThrottledRequests | 0 であること(オンデマンドのため通常は起きない) |
| 4 | アラームの状態 | 2つのエラーアラーム | 「アラーム状態」になっていないこと |

## 使い方

- ワークショップの開始前に、主催者の端末でダッシュボードを開いておく(通知は設定しないため。[Q1])。
- 確認の目安は「Lambda エラー数」と「アラームの状態」。異常があれば `rollback-runbook.md` の「当日の応急対応」に従う。
