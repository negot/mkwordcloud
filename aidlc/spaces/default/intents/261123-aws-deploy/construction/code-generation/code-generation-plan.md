# Code Generation Plan: 承認つきデプロイスクリプト

## Summary

- Builds: 承認つきデプロイスクリプト(TypeScript、`npm run deploy` から実行)と、その単体テスト、手順の文書
- Touches: `scripts/deploy/`(新規)、`package.json`、`vitest.config.ts`、`tsconfig.json`、`.gitignore`、`docs/deploy.md`(新規)。AWS 側の CDK 定義(`infra/`)は変更しない
- Tests: 約 45 件の単体テスト(部品ごとに 5 から 8 件)と、流れ全体の結合テスト 5 件。テストランナーは既存の vitest。追加コードの行カバレッジ 80% 以上

## 対象と方針

- 対象は 1 つのまとまり(Unit なし)。設計は `construction/infrastructure-design/` と `construction/nfr-design/` による。
- 新しいコードは `scripts/deploy/` に置く。実行は `tsx`(既存の devDependency)。ESM、コメントとメッセージは日本語、要件 ID(FR、NFR)を参照する。(team.md の Code Style)
- Lint と整形は導入しない。型検査(`tsc --noEmit`)を通す。
- **このステージでは AWS へのデプロイを実行しない**。実際のデプロイは後のステージで、人の承認を経て行う。
- テストの順序は test-after: 各層(部品)を実装してから、その層のテストを書いて実行する。(Testing Contract)
- 既存ファイルのうち、人のもの(`README.md`、`AGENTS.md`、`feature-mobile-form.md` など)は変更しない。変更するのは、動かすために必要な `package.json`、`vitest.config.ts`、`tsconfig.json`、`.gitignore` だけである。

## 注意(デプロイ前に人がすること)

- 現在、モバイル入力フォームの実装(`packages/web/src/join*.ts`、`join.html`、`join.css`、`packages/web/test/join-logic.test.ts`)と `scripts/build-web.mjs` の変更が、まだコミットされていない。新しいスクリプトは、未コミットの変更があるとデプロイしない(設計 Q2 A)。そのため、実際にデプロイする前に、これらをコミットする必要がある。コミットは、このステージでは行わない。

## Steps

- [x] **Step 1: プロジェクトの構成と設定の骨組み**
  - `scripts/deploy/src/` と `scripts/deploy/test/` を作る。
  - `tsconfig.json` の `include` に `scripts/deploy/src/**/*.ts` と `scripts/deploy/test/**/*.ts` を加える。
  - `vitest.config.ts` の `include` に `scripts/deploy/test/**/*.test.ts` を加える。
  - `.gitignore` に `deploy-logs/` と `cdk.out.deploy/` を加える。
  - 実装: FR3.1、NFR2.4。要件の出典: infrastructure-specification.md「デプロイ用に新しく加わるもの」
- [x] **Step 2: テストランナーの確認とカバレッジの設定**
  - 既存の vitest が動くことを確認し、このまとまりの実行コマンドを `unit-test-instructions.md` に記録する(`npx vitest run scripts/deploy`)。
  - カバレッジ用に `@vitest/coverage-v8` を devDependency に加える(`npm install -D`)。`vitest.config.ts` に、`scripts/deploy/src/**` だけを対象にした行カバレッジのしきい値 80% を設定する。しきい値を下げて通すことはしない。
  - 実装: NFR4.1、NFR4.2
- [x] **Step 3: 共通部品を実装する(AwsCli、実行、伏せ字、StepTimer)**
  - `exec.ts`: 子プロセスを、シェルを経由せず引数の配列で実行する。標準入出力を引き継ぐ実行(CDK の対話確認用)と、出力を取得する実行を持つ。
  - `redact.ts`: アクセスキー、シークレット、セッショントークンの形式を伏せ字にする。
  - `step-timer.ts`: 各ステップの開始、終了、結果、所要時間を表示し、合計が 15 分を超えたら目安を超えたことを表示する(失敗にはしない)。
  - `aws-cli.ts`: AWS CLI を呼ぶ薄い層(STS、CloudFormation の状態、イベント)。
  - 実装: NFR2.3、NFR3.1、NFR3.4、Q7 A
- [x] **Step 4: 共通部品のテストを書いて実行する**
  - 伏せ字(鍵の形式、通常の文字列は変えない)、配列引数でシェルを通さないこと、StepTimer の表示と 15 分超過の目安の表示、AwsCli の出力の解析。
- [x] **Step 5: ApprovalLog を実装する**
  - `approval-log.ts`: JSON Lines。行の種類は `abort`、`start`、`approval`、`deploy`、`postcheck`、`humancheck`、`end`。1 行を 1 回の追記で書く。`attemptId` で束ねる。書けないときは失敗を返す。秘密情報と入力テキストは書かない。
  - 実装: FR3.5、NFR1.4、NFR2.4、NFR2.5
- [x] **Step 6: ApprovalLog のテストを書いて実行する**
  - 各行の項目、追記(上書きしない)、書けないときの失敗、`.gitignore` に `deploy-logs/` があること、秘密情報を含まないこと。
- [x] **Step 7: Preflight を実装する**
  - `preflight.ts`: 未コミットの変更(未追跡を含む。`deploy-logs/` と `cdk.out.deploy/` は除く)、STS のアカウント ID と呼び出し元、リージョンの形式、`CDKToolkit` の状態、`WordcloudStack` の状態(`UPDATE_ROLLBACK_FAILED` や処理中は不可)。ビルド後の再確認(追跡対象の変更だけ)。確認は並列に実行する。
  - 実装: FR3.7、NFR1.2、NFR3.5、NFR2.2
- [x] **Step 8: Preflight のテストを書いて実行する**
  - 全部成功、未コミットあり、ブートストラップなし、スタックが更新不可、リージョンの形式が不正、認証切れ、再確認で変更を検出。
- [x] **Step 9: BuildVerify を実装する**
  - `build-verify.ts`: `npm run build:web`、`npm run build:extension`、`npm run typecheck`、`npm test` を順に実行し、失敗したら以降を実行しない。
  - 実装: FR3.4、NFR1.3、NFR4.2、NFR6.1
- [x] **Step 10: BuildVerify のテストを書いて実行する**
  - 順序、途中の失敗で止まること、終了コードの伝え方。
- [x] **Step 11: SynthDiff、AssemblyHash(AssemblyVerifier)、RiskDetector を実装する**
  - `synth-diff.ts`: `cdk.out.deploy/` を削除してから、`npx cdk synth --app "npx tsx infra/bin/app.ts" --output cdk.out.deploy` を一度だけ実行し、同じ保存先に対して `npx cdk diff --app cdk.out.deploy` を実行して差分を表示する。
  - `assembly-hash.ts`: 保存先の通常のファイルを相対パスの昇順に並べ、「相対パス、改行、内容」を SHA-256 に与える。CDK の一時ファイルは除外する。承認後に計算し直して照合し、結果(承認時のハッシュ、現在のハッシュ、一致か不一致か)を表示する。
  - `risk-detector.ts`: 差分から、DynamoDB と S3 の置換、削除と、スケーリング設定(課金モード、同時実行の予約、スロットル値)の変更を検出する。
  - 実装: FR2.3、FR3.2、FR3.6、NFR1.1、NFR5.4
- [x] **Step 12: それらのテストを書いて実行する**
  - ハッシュの再現性(同じ内容で同じハッシュ、一文字変えると違う)、除外ファイル、不一致の検出、置換と削除の検出(DynamoDB、S3、それ以外は検出しない)、スケーリング設定の変更の検出。
- [x] **Step 13: ApprovalPrompter と HumanCheck を実装する**
  - `prompter.ts`: 確認プロンプトの共通部(許可した回答だけ有効、それ以外は「いいえ」)、データ消失の確認、承認プロンプト。
  - `human-check.ts`: 画面表示、WebSocket の接続、送信から表示までの動作を 1 項目ずつ尋ね、「確認した」「確認しなかった」「問題があった」を記録する。URL は画面に表示するだけで、ブラウザは開かない。
  - 実装: FR3.2、FR3.3、FR3.6、FR5.3、FR5.4、FR5.5、NFR1.1、NFR1.5
- [x] **Step 14: それらのテストを書いて実行する**
  - 肯定、否定、不正な入力、無回答。「確認しなかった」は失敗にならないこと、「問題があった」で非ゼロになること。
- [x] **Step 15: Deployer と FailureReporter を実装する**
  - `deployer.ts`: `npx cdk deploy --app cdk.out.deploy --outputs-file cdk-outputs.json` を、`--require-approval never` を付けず、標準入出力を引き継いで実行する。CDK の確認で拒否されたら中止し、記録する。非対話の環境では実行しない。
  - `failure-report.ts`: 失敗時に、スタックの状態、失敗したリソースとその理由を CloudFormation のイベントから取得して表示する。
  - 実装: FR6.1、FR6.2、NFR1.1、NFR5.3、NFR5.6、NFR5.7
- [x] **Step 16: それらのテストを書いて実行する**
  - 実行する引数に `--require-approval never` が含まれないこと、保存先を渡すこと、失敗時の表示、非対話の環境で実行しないこと。
- [x] **Step 17: PostDeployChecker を実装する**
  - `post-deploy.ts`: `cdk-outputs.json` の `WebUrl`、`ApiUrl` を読む。存在しない部屋コードへの `GET {ApiUrl}/rooms/{code}` で 404 を確認し(読み取りだけ)、表示用 Web が開くこと(200)を確認する。1 回 10 秒のタイムアウト、30 秒おきに最大 5 回の再試行。データは送信しない。
  - 実装: FR5.1、FR5.2、NFR2.6、NFR3.6
- [x] **Step 18: PostDeployChecker のテストを書いて実行する**
  - 成功、再試行して成功、再試行を使い切って失敗、タイムアウト、出力ファイルがない、POST などを送らないこと。
- [x] **Step 19: main(流れの制御)を実装する**
  - `main.ts`: logical-components.md の流れどおりに各部品をつなぐ。記録の規則(`abort`、`start`、`approval`、`deploy`、`postcheck`、`humancheck`、`end`)と、終了コード、ログに書けないときの画面表示だけの終了を実装する。デプロイの後に `npm run apply-outputs` を実行する。非対話の環境では実行しない。
  - 実装: FR3.1 から FR3.7、FR6.1、NFR1.1 から NFR1.5
- [x] **Step 20: 流れ全体の結合テストを書いて実行する**
  - 部品を差し替えて、次の 5 つの経路を確認する: 全部成功、事前確認の失敗(`abort` のみ)、承認の拒否(`approval` と `end`)、ハッシュの不一致(デプロイしない)、デプロイの失敗(失敗の表示と `end`)。
- [x] **Step 21: 環境とビルドの設定**
  - `package.json` の `deploy` を `tsx scripts/deploy/src/main.ts` に置き換える(`--require-approval never` を外す)。`test` の対象に `scripts/deploy` を加える。`test:coverage` を追加する。
  - 実装: FR3.1、project.md の Mandated(承認なしのデプロイ経路を残さない)
- [x] **Step 22: 文書とトレーサビリティ**
  - `docs/deploy.md`(新規): 実行方法、前提(AWS CLI、IAM Identity Center のプロファイル、`AWS_PROFILE`)、承認ログの場所と読み方、コミットしてから実行すること、ロールバックが詰まったときの手作業の手順、自動確認の限界(WebSocket などは人が確認)。`README.md` は変更しない。
  - `traceability.json` と `code-summary.md` を書く。
  - 実装: NFR3.2、NFR3.3、FR5.4

## 要件との対応

| 要件 | 対応する Step |
|---|---|
| FR2.3、FR3.6 | 11、13、19 |
| FR3.1 から FR3.5 | 1、5、13、19、21 |
| FR3.7 | 7 |
| FR5.1 から FR5.5 | 13、17、22 |
| FR6.1、FR6.2 | 15、19 |
| NFR1.1 から NFR1.5 | 5、7、9、11、13、15、19 |
| NFR2.1 から NFR2.6 | 3、5、7、17 |
| NFR3.1、NFR3.4 から NFR3.6 | 3、7、17 |
| NFR3.2、NFR3.3 | 21、22 |
| NFR4.1、NFR4.2、NFR6.1 | 2、9、全 Step のテスト |
| NFR5.1 から NFR5.7 | 11、15、19(NFR5.1 と NFR5.2 は設計の方針で、コードの変更なし) |

## 計画しないこと

- AWS 上のリソースの変更(`infra/lib/wordcloud-stack.ts` は変更しない)。
- CI/CD パイプライン、ESLint、Prettier、カスタムドメイン、アラームの通知先の追加。
- デプロイの実行(後のステージで行う)。

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/construction/infrastructure-design/`(infrastructure-specification.md、cicd-pipeline.md、monitoring-design.md)
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/`(六つの文書)
- `aidlc/spaces/default/intents/261123-aws-deploy/inception/requirements-analysis/requirements.md`
- `package.json`、`vitest.config.ts`、`tsconfig.json`、`.gitignore`、`infra/bin/app.ts`、`scripts/apply-outputs.mjs`

## Assumptions & Open Questions

- Assumptions: `@vitest/coverage-v8` を devDependency として加えてよい(カバレッジを測るために必要)。保存したテンプレートのディレクトリを `cdk deploy --app` に渡して、再生成せずにデプロイできる。
- Open questions: None.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "各テスト可能な層を実装してから、その層のテストを書いて実行する。",
  "scope": "infra",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 各テスト可能な層を実装してから、その層のテストを書いて実行する。\n- **Methodology evidence**: インタビュー Q3 で test-after を選んだ。履歴は 3 コミットのみで、テストが実装に先行した痕跡はない。各 package と infra に vitest のテストがあり、TDD/BDD を示す feature ファイルやシナリオ仕様は見つからない。\n- カバレッジ: 行カバレッジ 80% 以上を必須とし、CI で確認する(インタビュー Q4)。この基準を満たすために基準を下げない。\n- テスト実行: `npm test`(vitest run、タイムアウト 60 秒)。型検査は `npm run typecheck`。\n- infra には CDK のアサーションテスト(`infra/test/stack.test.ts`)があり、リソース数・アラーム・ダッシュボードを検証している。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
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
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
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
  "input_sha256": "sha256:bb0786a65e20ef908bf97f0c9e4490a15619ef815728e2dea1d232d4276399d9",
  "contract_sha256": "sha256:25b6e0b50213cc869dd298a318719a8a054ed9fe8c4d94182e325f3c8a66ce31"
}
```
