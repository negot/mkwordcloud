# ビルドとテストのまとめ

## 全体の状況

| 項目 | 状況 |
|---|---|
| ビルド | 成功(`npm run build`、`cdk synth` の静的確認) |
| テスト | 224 件すべて成功(新しいテスト 132 件を含む)。失敗 0、スキップ 0 |
| カバレッジ | `scripts/deploy/src/**` の行カバレッジ 97.94%(しきい値 80%。下げていない) |
| 型検査 | エラーなし |
| 全体の判定 | 実行した項目はすべて成功。実環境が必要な項目は、Deployment Execution の担当で、未実行 |

詳しい結果は `test-results.md`、ビルド手順は `build-instructions.md`。

## テストの種類

| 種類 | ファイル | 状況 |
|---|---|---|
| ビルド手順 | `build-instructions.md` | 作成済み |
| 単体テスト | `code-generation/unit-test-instructions.md`(Code Generation で作成) | 実行済み(132 件) |
| 結合テスト | `integration-test-instructions.md` | 自動の 21 件は実行済み。実環境での確認は Deployment Execution |
| 性能テスト、セキュリティテスト | 作成しない(Standard の強度では対象外) | ― |

## カバレッジの期待

- プロジェクト全体: 既存のテストが通り続けること(224 件すべて成功)。
- `scripts/deploy/src/**`: 行 80% 以上(実測 97.94%)。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1 | nfr-requirements/tech-stack-decisions.md NFR4.1、team.md Testing Posture | `scripts/deploy/src/**` の行カバレッジ 80% 以上 | 97.94% | `npx vitest run scripts/deploy --coverage` の出力(終了コード 0)、`test-results.md` | build-and-test | Met |
| T2 | NFR4.2 | 既存のテストが通り続ける | 224 件中 224 件成功、失敗 0 | `npm test`(終了コード 0) | build-and-test | Met |
| T3 | NFR6.1、team.md Code Style | 型検査が通る | エラー 0 件 | `npm run typecheck`(終了コード 0) | build-and-test | Met |
| T4 | FR3.4、infrastructure-design/cicd-pipeline.md 段階 2 | `build:web`、`build:extension` が成功する | 成功。`join.js` を含む | `npm run build`(終了コード 0)、`packages/web/dist` の一覧 | build-and-test | Met |
| T5 | infrastructure-design/infrastructure-specification.md | `cdk synth` でテンプレートを作れる | 成功。`WordcloudStack.template.json` ができた | `npx cdk synth ... --output cdk.out.deploy`(終了コード 0) | build-and-test | Met |
| T6 | NFR1.1、project.md Mandated | `--require-approval never` を使う経路がない | 実行する引数にも、`package.json` にもない | 検索の結果(`test-results.md`)、`scripts/deploy/test/deploy.test.ts` の検証 | build-and-test | Met |
| T7 | NFR2.4 | 承認ログとテンプレートの保存先が git 管理外 | `.gitignore` の 41、42 行目に一致 | `git check-ignore -v` の出力 | build-and-test | Met |
| T8 | team.md Testing Posture、Testing Contract の CI 実行の義務 | 計画に CI Pipeline がある場合、CI でテストを実行する | 計画に CI Pipeline があり、まだ先にある | `aidlc-state.md`(3.7 ci-pipeline が EXECUTE) | ci-pipeline | N/A(CI Pipeline がこの先にあり、そこが CI での実行を整える) |
| T9 | nfr-design/performance-design.md NFR3.4 | デプロイスクリプト全体の所要時間 15 分(目安。超えても失敗としない) | ― | 実際のデプロイの実行時間は、このステージでは測れない | deployment-execution | N/A(設計で「目安」と決めたもので、合否の目標ではない。実測は Deployment Execution で記録する) |
| T10 | NFR3.5、NFR3.6 | 事前確認と差分表示は 2 分以内。自動確認は再試行を含めて 4 分以内(どちらも目安) | ― | 実際の通信が必要。再試行の回数と間隔と、タイムアウトは単体テストで確認済み | deployment-execution | N/A(設計で「目安」と決めたもの。実測は Deployment Execution) |
| T11 | NFR5.3 | デプロイの失敗から 1 時間以内に復旧する | ― | 実際の失敗が必要。失敗時の状態表示と、手作業の手順(`docs/deploy.md`)は確認済み | deployment-execution | N/A(実際に失敗を起こさないと測れない復旧の目標。起きたときに記録する) |

## 準備の状況

| 観点 | 判定 |
|---|---|
| ビルドの準備 | できている |
| テストの準備 | できている(自動のテストはすべて成功) |
| デプロイの準備 | まだ。実環境での確認と、人の承認が必要。デプロイ前に、IAM Identity Center へのサインイン(環境の認証情報が期限切れ)と、変更のコミットが必要 |

## 既知の制限と残っている項目

- **FR1.2(Chrome 拡張機能の配布)**: 要件定義で対象外。全体のトレーサビリティで「未対応」と出る(`cross-unit-traceability.md`)が、意図した対象外である。
- **実環境でしか確認できないこと**(Deployment Execution で確認する。手順は `integration-test-instructions.md`):
  - 実際の `cdk diff` の出力で、DynamoDB と S3 の置換、削除を検出できるか(テスト用データは手書きの例)
  - 保存したテンプレートでの `cdk deploy --app` の動作
  - CDK の確認の表示と、拒否したときの判定
- T9、T10、T11 は、設計で「目安」または実際の事象が必要な目標なので `N/A` としている。

## ブラウザの確認について

このステージで確認したのはビルド、型検査、Node 上の単体テストと結合テストだけである。実際のブラウザでの動作(モバイル入力フォームの表示、WebSocket の接続)は確認していない。これらは、Deployment Execution の人による確認で行う。

## Sources

- `test-results.md`、`build-instructions.md`、`integration-test-instructions.md`、`cross-unit-traceability.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-requirements/`、`nfr-design/`(目標の出典)
- `aidlc/spaces/default/intents/261123-aws-deploy/aidlc-state.md`(計画の段階)

## Assumptions & Open Questions

- Assumptions: T9 から T11 は、設計で目安とした値で、合否の目標ではない。
- Open questions: None.
