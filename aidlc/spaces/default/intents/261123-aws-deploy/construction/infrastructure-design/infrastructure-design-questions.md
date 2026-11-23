# Infrastructure Design 質問

対象: 既存スタック `WordcloudStack`(CloudFront と S3、API Gateway の HTTP と WebSocket、Lambda、DynamoDB、CloudWatch)の更新と、承認つきデプロイスクリプト。既存の CDK 定義を読んだところ、AWS 側の構成は変えずに済みます。ここでは、デプロイの仕組みと設定の決め方を確認します。次の 7 点を確認させてください。

## Q1. [開発] 既存の `npm run deploy` の扱い
現在の `npm run deploy` は `cdk deploy ... --require-approval never` で、承認なしにデプロイします。新しい承認つきスクリプトとの関係をどうしますか。

A. `npm run deploy` を新しいスクリプトに置き換える(承認なしの経路を残さない。推奨)
B. 新しいスクリプトを別名(例: `deploy:safe`)で追加し、`npm run deploy` は残す
X. Other (please specify)

[Answer]:A

## Q2. [運用] スタックの削除防止
スタックを誤って削除すると、DynamoDB と S3 のデータが消えます(`RemovalPolicy.DESTROY`)。スタックに削除防止(termination protection)を付けますか。

A. 付ける。削除するときは、先に削除防止を解除する必要がある
B. 付けない
X. Other (please specify)

[Answer]:B

## Q3. [運用] 本番で許可する拡張機能 ID
CORS と WebSocket の許可 Origin に使う拡張機能 ID は、どれにしますか。(現在の既定値は `infra/lib/config.ts` の `DEFAULT_EXTENSION_ID`)

A. 既定値のまま使う
B. 別の ID を使う(ID を Other に記入)
X. Other (please specify)

[Answer]:A

## Q4. [開発] 承認ログとテンプレート保存先の置き場所
承認ログのファイルと、保存したテンプレート一式の置き場所は、どうしますか。どちらも git 管理外にします。

A. 承認ログは `deploy-logs/approvals.jsonl`、テンプレートは `cdk.out.deploy/`(リポジトリ直下)
B. 別の場所にする(パスを Other に記入)
X. Other (please specify)

[Answer]:A

## Q5. [開発] デプロイ後の確認で使う URL の取得元
デプロイ後の自動確認に使う URL(表示用 Web、HTTP API、WebSocket)は、どこから取りますか。

A. `cdk deploy` が出力する `cdk-outputs.json` から取る(既存の `apply-outputs` と同じ)
B. CloudFormation から、スタックの出力を取り直す(AWS CLI の `describe-stacks`)
X. Other (please specify)

[Answer]:A

## Q6. [品質] HTTP API の応答確認のやり方
デプロイ後の HTTP API の応答確認は、どのリクエストにしますか。本番データを書き込まないものにします。

A. 存在しない部屋コードに対する `GET /rooms/{code}` を送り、404 が返ることを確認する(読み取りだけ)
B. `OPTIONS /rooms` の事前確認リクエストを送り、許可 Origin のヘッダーが返ることを確認する
C. A と B の両方を行う
X. Other (please specify)

[Answer]:A

## Q7. [開発] 人による確認のときの画面の開き方
デプロイ後の人による確認(画面表示)で、表示用 Web の URL をどう提示しますか。

A. URL を画面に表示するだけにする(人が自分でブラウザを開く)
B. 既定のブラウザで URL を自動的に開く(macOS の `open` など)
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
