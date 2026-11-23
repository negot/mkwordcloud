# Team Practices

## Way of Working

- **Integration branch**: main
- 私たちは `main` に直接コミットする。作業用ブランチや Pull Request は使わない(インタビュー Q1)。
- 作業単位ごとに 1 コミットとし、メッセージは英語の短い要約文にする(例: "Add CloudWatch dashboard, observability records, ...")。
- レビューを必須にする運用はしていない。

## Walking Skeleton

- 薄い縦断スライス(ウォーキングスケルトン)は作らない(インタビュー Q2)。
- 既存アプリは ap-northeast-1 に初版がデプロイ済みで、エンドツーエンドの経路は既に通っている(コミット 6177df5)。今回は既存スタックの再デプロイとパイプライン化を直接進める。

## Testing Posture

- **Methodology**: test-after
- **Ordering**: 各テスト可能な層を実装してから、その層のテストを書いて実行する。
- **Methodology evidence**: インタビュー Q3 で test-after を選んだ。履歴は 3 コミットのみで、テストが実装に先行した痕跡はない。各 package と infra に vitest のテストがあり、TDD/BDD を示す feature ファイルやシナリオ仕様は見つからない。
- カバレッジ: 行カバレッジ 80% 以上を必須とし、CI で確認する(インタビュー Q4)。この基準を満たすために基準を下げない。
- テスト実行: `npm test`(vitest run、タイムアウト 60 秒)。型検査は `npm run typecheck`。
- infra には CDK のアサーションテスト(`infra/test/stack.test.ts`)があり、リソース数・アラーム・ダッシュボードを検証している。

## Deployment

- 環境は `prod` のみとし、デプロイの前に人の承認を挟む(インタビュー Q5)。`--require-approval never` のまま承認なしで自動デプロイすることはしない。
- デプロイ先は AWS CDK v2 スタック `WordcloudStack`。リージョンは環境変数 `WORDCLOUD_REGION`(既定 ap-northeast-1)、アカウントは `CDK_DEFAULT_ACCOUNT`。
- 現状は `npm run deploy`(web と拡張機能をビルドし `cdk deploy`)による手動デプロイで、CI/CD パイプラインはない。出力は `cdk-outputs.json`(git 管理外)で、`npm run apply-outputs` でクライアント設定へ反映する。
- データは使い捨てとして扱う。DynamoDB、S3、ログは `RemovalPolicy.DESTROY` のままにし、デプロイに失敗したときは再デプロイで直す(インタビュー Q6)。

## Code Style

- TypeScript(ESM)。コメントとメッセージは日本語で、要件 ID(FR/NFR)を参照する。
- チェックは型検査(`tsc --noEmit`)のみとする。ESLint と Prettier は導入しない(インタビュー Q7)。
- UI は素の DOM と `data-testid` 属性。ブラウザコードは `@wordcloud/core/protocol` と `/constants` のサブパスを import する。
- 重複ユーティリティ(parseConfig、backoffDelay、normalizeRoomCode)は既知の技術的負債として残っている。
