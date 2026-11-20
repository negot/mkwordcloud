# 分散トレース

決定: AWS X-Ray による分散トレースは使わない。[Q3]

## 理由

- 処理は、API Gateway の後ろの Lambda 1段だけ(Lambda から DynamoDB と、接続への送信)で、サービス間の呼び出しの連鎖が無い。
- 遅延の原因は、Lambda の実行時間(ダッシュボード)と、ログの `REPORT` 行(`log-queries.md` のクエリ2、3)で特定できる。
- 設定と費用を増やさない。

## 後から有効にする場合

- `infra/lib/wordcloud-stack.ts` の Lambda に `tracing: lambda.Tracing.ACTIVE` を追加して再デプロイする(IAM の権限は CDK が付ける)。
- DynamoDB の呼び出しまで追うには、アプリに AWS X-Ray SDK を組み込む必要がある。
