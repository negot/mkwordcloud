# コード生成計画: リアルタイム・ワードクラウド

## Summary

- Builds: Chrome拡張(MV3)・サーバー(Lambda/ローカル)・表示Webページ・AWS CDKの、リアルタイム・ワードクラウド一式
- Touches: `packages/{core,server,web,extension}`、`infra/`、`scripts/`、`README.md`、ルートの `package.json` 等、`.gitignore`(`node_modules`等の追記のみ)
- Tests: Vitestによる単体テスト約40件(要件ごとに1件以上、コンポーネントごとに正常系1件以上)

## Assumptions

次のデータ項目は、要件が直接は求めていませんが、実装に必要なため計画に含めます(DynamoDB 単一テーブル `wordcloud`)。

- `ROOM#<code>` / `META`: `hostKeyHash`(主催者キーのハッシュ。FR1.3、FR1.6、NFR2.7)、`createdAt`、`ttl`(FR1.5、NFR3.2)。
- `ROOM#<code>` / `WORD#<word>`: `count`、`ttl`(FR3.1、FR3.7)。
- `ROOM#<code>` / `VIEWER#<connId>`: 表示ページへの配信先(FR3.5)。`ttl`付き。
- `CONN#<connId>` / `META`: `room`、`role`、`clientId`、`ttl`(接続からルームを引くため)。
- `RATE#<room>#<clientId>` / `META`: `lastAt`、`windowStart`、`windowCount`、`ttl`(NFR2.5)。`clientId`は拡張機能が作る匿名のランダム値で、個人を特定しない(NFR3.1)。

## ステップ(テスト後置: 実装 → そのレイヤーのテストを書いて実行)

- [ ] Step 1: プロジェクト骨格。npm workspaces、`tsconfig.base.json`、各パッケージの `package.json`、`.gitignore` への `node_modules`、`dist`、`cdk.out` の追記。(NFR5.1)
- [ ] Step 2: テストランナー(Vitest)の設定と、実行コマンドの記録(`unit-test-instructions.md`)。(NFR6.1、NFR6.2)
- [ ] Step 3: `packages/core` の実装。定数(100文字、レート)、サニタイズ、ルームコード/主催者キー生成とハッシュ、レート制限の純粋関数、日本語/英語の語分割(kuromoji.js、ストップワード、品詞除外)。(FR1.2、FR3.2、FR3.3、FR3.4、NFR2.3、NFR2.4、NFR2.5、NFR2.7)
- [ ] Step 4: `packages/core` のテスト作成と実行。
- [ ] Step 5: `packages/server` のデータアクセス層。`Repository` インターフェース、インメモリ実装、DynamoDB実装。(FR1.5、FR3.7、NFR3.1、NFR3.2)
- [ ] Step 6: データアクセス層のテスト作成と実行(インメモリ実装と、`aws-sdk-client-mock` によるDynamoDB実装)。
- [ ] Step 7: `packages/server` のビジネスロジック。ルーム作成/参加/終了/リセット、投稿の検証・語分割・集計、表示ページへの配信、再接続時のスナップショット、Originの許可判定。(FR1.1〜FR1.6、FR2.2、FR2.4、FR3.1〜FR3.7、NFR2.2、NFR2.6)
- [ ] Step 8: ビジネスロジックのテスト作成と実行。
- [ ] Step 9: `packages/server` のAPI層。HTTP API用ハンドラ、WebSocket用ハンドラ(Lambdaアダプター)、ローカル開発サーバー(`ws` + Node `http`、静的ファイル配信、`/config.json`)。(NFR6.1、NFR1.1)
- [ ] Step 10: API層のテスト作成と実行(HTTPの経路・CORS・認可、ローカルサーバーでのWebSocket往復)。
- [ ] Step 11: `packages/web` の実装。ホーム(ルーム作成・表示の開始)、ワードクラウド表示(d3-cloud、SVG、`textContent` のみ使用)、リアルタイム更新と自動再接続、主催者操作(リセット・終了)。(FR4.1〜FR4.7、NFR2.3)
- [ ] Step 12: Webの純粋ロジック(語の統合、サイズ計算、上位N語、URL/設定解析)のテスト作成と実行。
- [ ] Step 13: `packages/extension` の実装。MV3 `manifest.json`、ポップアップのチャットUI(参加・送信・エラー表示)、匿名 `clientId`、直近ルームコードの保存。(FR2.1〜FR2.6)
- [ ] Step 14: 拡張機能のプロトコル/状態ロジックのテスト作成と実行。
- [ ] Step 15: `infra` の実装。AWS CDK(TypeScript): S3 + CloudFront(OAC、セキュリティヘッダー)、DynamoDB(オンデマンド、TTL)、HTTP API、WebSocket API(スロットリング)、Lambda、CloudWatchアラーム/メトリクス、最小権限IAM。(NFR1〜NFR5)
- [ ] Step 16: インフラのテスト作成と実行(CDK `Template` によるアサーション)。
- [ ] Step 17: ビルド・環境設定。esbuildによるWeb/拡張のバンドル、拡張ZIPの作成、デプロイ後の設定反映スクリプト、100人規模の負荷模擬スクリプト `scripts/load-test.mjs`。(NFR5.2、NFR6.3)
- [ ] Step 18: ドキュメントとトレーサビリティ。`README.md`(ローカル起動、デプロイ、拡張機能の配布手順)、`code-summary.md`、`traceability.json`。

- [x] Step 19(変更依頼による追加): 接続単位のレート制限。`clientId` に依存せず、接続ID(`connId`)ごとに、1秒に1回・1分に20回を適用する。状態は既存の `RATE#<room>#<key>` アイテムの別キー(`conn:<connId>`)に保存し、新しいデータ項目は増やさない。`service.ts` の送信処理を変更し、`service.test.ts` に「`clientId` を変えても同じ接続からは制限される」テストを追加して実行する。(NFR2.5)

## 要件との対応(概要)

| 要件 | 主なステップ |
|------|--------------|
| FR1 ルーム管理 | 3, 5, 7 |
| FR2 拡張機能 | 7, 13 |
| FR3 集計・配信 | 3, 5, 7, 9 |
| FR4 表示ページ | 11 |
| NFR1 性能 | 9, 17(負荷模擬) |
| NFR2 セキュリティ | 3, 7, 11, 15 |
| NFR3 プライバシー | 5, 15 |
| NFR4 運用・コスト | 15 |
| NFR5 IaC | 15, 17 |
| NFR6 品質 | 2, 4, 6, 8, 10, 12, 14, 16, 17 |

## ファイルの扱い

- 既存の `.gitignore` は、`node_modules`、`dist`、`cdk.out` を除外するための追記だけを行います(AI-DLCの区間は変更しません)。`AGENTS.md` は変更しません。
- CDKのデプロイ(`cdk deploy`)と、AWSへのアクセスは、この段階では実行しません。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:feae9d085aef5a6a689ae09b6eb667008e9265d95c521ecd8210945ff5035031",
  "contract_sha256": "sha256:fe2496254319e21e91034e358a23ba8dee4d3b8b14ac7c6abdf0fec2a8be41ef"
}
```
