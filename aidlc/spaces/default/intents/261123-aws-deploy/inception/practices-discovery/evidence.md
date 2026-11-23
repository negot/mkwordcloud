# Evidence

## Sources

- git 履歴: `git log`(3 コミット: 6177df5 初版を ap-northeast-1 にデプロイ、d577355 ダッシュボード・観測記録・負荷試験・ガイド、9c136e5 最終スモークテスト結果)。ブランチは `main` のみ。HEAD は 9c136e5。
- 構成ファイル: package.json、cdk.json、vitest.config.ts、.gitignore、infra/bin/app.ts、infra/lib/config.ts、infra/test/stack.test.ts(部分読み)。
- リバースエンジニアリング成果物(aidlc/spaces/default/codekb/mkwordcloud/): code-structure.md、technology-stack.md、dependencies.md、code-quality-assessment.md、architecture.md、business-overview.md。
- 既定値: aidlc/spaces/default/memory/org.md(team.md と project.md は未記入の雛形)。
- インタビュー: practices-discovery-questions.md(Q1 から Q7 に回答済み、要約確認は Looks correct)。

## Inferences(証拠からの推定)

- ブランチが `main` のみで 3 コミットとも線形。トランクベースの直接コミットと整合する。
- Methodology は test-after。先行仕様の痕跡がなく、履歴が短いため確証は弱いが、人の回答(Q3)で確定した。
- Lint/format 未設定、CI なし。根拠: code-quality-assessment.md と `.github` 不在。

## AWS・デプロイの現状(見えている範囲)

- **IaC**: AWS CDK v2。`infra/lib/wordcloud-stack.ts` に CloudFront + S3(OAC)、HTTP API と WebSocket API(API Gateway v2)、Lambda 2 本(NODEJS_24_X / ARM64)、DynamoDB(PAY_PER_REQUEST、TTL)、CloudWatch アラーム 2 件とダッシュボード 1 枚(テストから確認)。
- **デプロイ済みの痕跡**: コミット履歴に ap-northeast-1 への初回デプロイがあり、`cdk-outputs.json` と `cdk.out/` が手元にある(どちらも git 管理外)。現在も稼働中かは未確認。
- **リージョン/アカウント**: `WORDCLOUD_REGION`(既定 ap-northeast-1)、`CDK_DEFAULT_ACCOUNT`。
- **ステージ**: WebSocket の `prod` のみ。
- **CI/CD**: なし。デプロイは `npm run deploy` の手動実行(`--require-approval never`)。
- **削除ポリシー**: DynamoDB・S3・ログは `RemovalPolicy.DESTROY`。
- **シークレット**: コード内のシークレットは確認していない(網羅検索は未実施)。拡張機能 ID は公開値として config.ts に固定されている。

## Interview decisions

- Q1 A: `main` に直接コミットする。Integration branch は `main`。
- Q2 A: ウォーキングスケルトンは作らない。既存スタックの再デプロイとパイプライン化を直接進める。
- Q3 A: test-after(実装してからテストを書く)。
- Q4 A: 行カバレッジ 80% 以上を必須とし、CI で確認する。
- Q5 A: 環境は `prod` のみ。デプロイ前に人の承認を挟む。Mandated として `ALWAYS require a human approval before deploying to prod` を記録した。
- Q6 B: データは使い捨てとし、`RemovalPolicy.DESTROY` を維持する。失敗時は再デプロイで直す。
- Q7 A: 型検査のみ。ESLint と Prettier は導入しない。
- Q1 から Q4、Q6、Q7 は人が強い制約として述べていないため、Mandated/Forbidden には記録していない。

## Unresolved uncertainty

- パイプライン基盤(GitHub Actions、CodePipeline など)とリポジトリのホスト先は未決定。
- パイプラインから AWS への認証方式(OIDC ロールなど)は未決定。
- 承認者の具体(誰が承認するか)と、承認を挟む仕組み(パイプライン上の手動承認、`cdk deploy` の確認など)は未決定。
- デプロイ後のスモークテストの確認項目は未決定。
- 既存の `WordcloudStack` を更新するか作り直すかは未確認(Q6 の再デプロイ回復方針からは更新が自然だが、人は明言していない)。
- AWS アカウント ID・ブートストラップ状況、独自ドメイン、WAF、コスト上限は未確認。
- カバレッジ 80% は現状の達成可否を測っていない。
