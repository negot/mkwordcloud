# インフラ仕様

対象: 既存スタック `WordcloudStack`(ap-northeast-1、`prod` のみ)と、それを更新する承認つきデプロイスクリプト。既存の CDK 定義(`infra/lib/wordcloud-stack.ts`)を読んだ結果、**AWS 上のリソース構成は変更しない**。この仕様は、現行の構成を記録し、デプロイの仕組みとして新しく加わるものを定める。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| コンピュート | サーバーレス。Lambda(Node.js 24、ARM64)が 2 つ: `WsHandler`(1024 MB、10 秒)、`HttpHandler`(256 MB、5 秒) | 既存のまま。デプロイで設計を変えない(NFR5.5) |
| ネットワーク | VPC なし。入口は CloudFront(HTTPS 強制)、API Gateway の HTTP API と WebSocket API | 既存のまま |
| ストレージ | DynamoDB(オンデマンド、TTL つき)、S3(非公開、OAC 経由で CloudFront から配信) | 既存のまま |
| 環境 | `prod` のみ。アカウント 1 つ、リージョンは `WORDCLOUD_REGION`(既定 ap-northeast-1) | 要件定義 FR2.2、Q3 |
| IaC の方法 | AWS CDK v2(TypeScript)。`npx tsx infra/bin/app.ts` をアプリとして使う | 既存のまま |
| デプロイの方法 | 承認つきの手元実行スクリプト。`cdk synth --output cdk.out.deploy` で一度だけ生成し、同じものを `cdk diff` と `cdk deploy` に渡す | NFR1.1、nfr-design の security-design.md |
| 既存の `npm run deploy` | 新しいスクリプトに置き換える。`--require-approval never` を使う経路を残さない | Q1 A、project.md の Mandated |
| スタックの削除防止 | 付けない。データを使い捨てとして扱う方針と一貫させる。誤って削除するとデータが消えるリスクは受け入れる | Q2 B |
| 拡張機能 ID | 既定値(`infra/lib/config.ts` の `DEFAULT_EXTENSION_ID`)のまま。CORS と WebSocket の許可 Origin に使う | Q3 A |
| 認証 | IAM Identity Center のプロファイル(`AWS_PROFILE`)。管理者権限。長期の鍵は使わない | NFR2.1、NFR2.2 |
| リソースの大きさ | 変更しない。DynamoDB はオンデマンド、HTTP API のスロットルは 20 回/秒(バースト 40)、WebSocket は 100 回/秒(バースト 200) | NFR5.4、NFR5.5 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| CloudFront | cdn | PriceClass 200、HTTPS へリダイレクト、圧縮、セキュリティヘッダー(HSTS、CSP など) | 既存のまま。デプロイ時に `BucketDeployment` が全パス(`/*`)を無効化する |
| S3(`WebBucket`) | storage | 公開アクセスなし、S3 管理の暗号化、SSL 強制、`RemovalPolicy.DESTROY`、`autoDeleteObjects` | 既存のまま。置換や削除は RiskDetector が検出する(FR3.6) |
| DynamoDB(`Table`) | database | オンデマンド、TTL 属性 `ttl`、`RemovalPolicy.DESTROY` | 既存のまま。置換や削除は RiskDetector が検出する(FR3.6) |
| API Gateway(HTTP) | api | `wordcloud-http`、`/rooms` 系の 3 ルート、スロットル 20/40 | 既存のまま。CORS は Lambda で処理する |
| API Gateway(WebSocket) | api | `wordcloud-ws`、ステージ `prod`、スロットル 100/200 | 既存のまま |
| Lambda | compute | `WsHandler` と `HttpHandler`。ログは CloudWatch に 2 週間保管 | 既存のまま |
| CloudWatch | monitoring | ダッシュボード `wordcloud-workshop`、Lambda のエラーのアラーム 2 つ | 既存のまま。`monitoring-design.md` を参照 |
| CloudFormation | iac | スタック `WordcloudStack`、ブートストラップ用の `CDKToolkit` | デプロイの事前確認で状態を確認する(FR3.7) |
| IAM Identity Center | auth | 一時的な認証。管理者権限 | 新しいリソースではない。手元の AWS CLI の設定を使う |

## デプロイ用に新しく加わるもの(AWS の外)

AWS 上には新しいリソースを作らない。次は、リポジトリと手元に加わるものである。実装は Code Generation で行う。

| 追加物 | 場所 | 内容 |
|---|---|---|
| デプロイスクリプト | `scripts/deploy/`(TypeScript、`tsx` で実行) | `logical-components.md` の各コンポーネント。`npm run deploy` から呼ぶ |
| 承認ログ | `deploy-logs/approvals.jsonl` | JSON Lines。git 管理外 |
| テンプレートの保存先 | `cdk.out.deploy/` | `cdk synth --output` の出力。git 管理外 |
| `.gitignore` の追記 | リポジトリ直下 | `deploy-logs/` と `cdk.out.deploy/` を登録する |
| `package.json` の変更 | リポジトリ直下 | `deploy` を新しいスクリプトに置き換える。`--require-approval never` を外す |
| デプロイ手順の文書 | `README`(または `docs/`) | 実行方法、前提(AWS CLI、Identity Center のプロファイル)、承認ログの場所、ロールバックが詰まったときの手作業の手順 |

## Shared Infrastructure

該当なし。単一のスタックだけで、Unit をまたぐ共有リソースはない。

## デプロイ時の前提と注意

- `cdk synth` の前に、表示用 Web のビルド(`npm run build:web`)が済んでいる必要がある。`packages/web/dist` がないと、`BucketDeployment` が仮のページ(placeholder)を配置してしまう。スクリプトは、ビルドを先に実行してから生成する(FR3.4)。
- Lambda のバンドルには esbuild を使う。手元に Node 20 以上が必要。
- 出力(`WebUrl`、`ApiUrl`、`WsUrl`、`ExtensionId`、`DashboardUrl`)は、`cdk deploy --outputs-file cdk-outputs.json` で書き出す。デプロイ後の確認と `apply-outputs` が、これを使う。

## リスク

| リスク | 内容 | 対応 |
|---|---|---|
| データ消失 | `RemovalPolicy.DESTROY` のため、置換や削除でデータが消える。削除防止も付けない | 差分の検出と 2 段の確認(FR3.6)。スタックの手動削除は防げない(Q2 B) |
| 管理者権限 | 権限が広い | 承認の前は読み取りだけ(NFR2.2) |
| 生成の再現性 | 生成物がデプロイの直前と変わる | テンプレートを一度だけ生成してハッシュで照合(NFR1.1) |

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/`(六つの文書)
- `infra/lib/wordcloud-stack.ts`、`infra/bin/app.ts`、`infra/lib/config.ts`、`package.json`
- `aidlc/spaces/default/codekb/mkwordcloud/technology-stack.md`
- `infrastructure-design-questions.md`(Q1 から Q4)

## Assumptions & Open Questions

- Assumptions: 既存の `WordcloudStack` が ap-northeast-1 で稼働していて、CDK のブートストラップが済んでいる(要件定義の A2)。
- Open questions: None.
