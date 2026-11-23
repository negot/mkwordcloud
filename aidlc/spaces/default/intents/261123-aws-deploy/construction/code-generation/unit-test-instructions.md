# テスト手順: 承認つきデプロイスクリプト

## テストの枠組み

- フレームワーク: vitest(既存、`vitest.config.ts`)。タイムアウトは 60 秒。
- 対象: `scripts/deploy/src/**`。テストは `scripts/deploy/test/**/*.test.ts`。
- 方針: test-after(各部品を実装してから、その部品のテストを書いて実行する)。Standard の強度で、部品ごとに 5 から 8 件の単体テストと、流れ全体の結合テスト 5 件。

## 実行コマンド(このまとまりだけ)

最初のテストの前に実行できる、このまとまりのコマンド:

```
npx vitest run scripts/deploy
```

1 つのテストファイルだけを実行するときは、パスを指定する。例:

```
npx vitest run scripts/deploy/test/approval-log.test.ts
```

型検査(このまとまりを含む全体):

```
npm run typecheck
```

## カバレッジ

- 目標: `scripts/deploy/src/**` の行カバレッジ 80% 以上。(team.md、NFR4.1)しきい値は下げない。
- 測定: `@vitest/coverage-v8` を使う。設定は `vitest.config.ts` の `coverage` で、対象を `scripts/deploy/src/**` に限る。
- このしきい値が失敗したときは、しきい値以外の原因でテストが落ちたのではない。テストを足して基準を満たす。
- 測定のコマンドは、しきい値で終了コードが非ゼロになることがあるため、単独のコマンドとして実行する(後続のコマンドを付けない):

```
npx vitest run scripts/deploy --coverage
```

プロジェクト全体の既存テスト(`npm test`)が通り続けることは、Build and Test が全体のスイートで確認する。

## モックとスタブ

- 子プロセス(`aws`、`cdk`、`git`、`npm`)は実行しない。`exec.ts` を差し替える(依存の注入)。実行された引数の配列を検証する。
- AWS の応答は、固定の JSON(STS、CloudFormation のスタックの状態とイベント)で差し替える。
- HTTP の確認は、`fetch` を差し替える。ネットワークには出ない。
- 確認プロンプトの入力は、あらかじめ決めた回答の列で差し替える。
- 時刻と再試行の待ち時間は、偽のタイマー(`vi.useFakeTimers`)で進める。実際には待たない。
- ファイル(承認ログ、テンプレートの保存先)は、一時ディレクトリ(テストごとに作って消す)で行う。リポジトリの `deploy-logs/` には書かない。

## テストデータ

- 差分の例(DynamoDB と S3 の置換、削除、スケーリング設定の変更、変更なし)は、`scripts/deploy/test/fixtures/` に固定のテキストとして置く。
- ハッシュのテストは、一時ディレクトリに小さなファイルを作って行う。
- 本物の認証情報、本物の AWS アカウント ID、入力テキストは、テストデータに含めない。伏せ字のテスト用には、形式だけが合う偽の文字列を使う。

## テストの内容(部品ごと)

| 部品 | 主な確認 |
|---|---|
| 共通部品(exec、redact、StepTimer、AwsCli) | シェルを通さず配列で渡す、鍵の形式の伏せ字、所要時間の表示と 15 分超過の目安の表示、AWS CLI の出力の解析 |
| ApprovalLog | 各行の項目、追記、書けないときの失敗、秘密情報を含まない、`.gitignore` の登録 |
| Preflight | 全部成功、未コミットあり、ブートストラップなし、スタックが更新不可、リージョンの形式、認証切れ、再確認 |
| BuildVerify | 順序、途中の失敗で止まる |
| SynthDiff、AssemblyHash、RiskDetector | ハッシュの再現性と不一致の検出、除外ファイル、置換と削除の検出、スケーリング設定の変更の検出 |
| ApprovalPrompter、HumanCheck | 肯定、否定、不正な入力、無回答、「確認しなかった」は失敗にしない、「問題があった」は非ゼロ |
| Deployer、FailureReporter | `--require-approval never` を含まない、保存先を渡す、失敗時の状態とリソースの表示、非対話の環境で実行しない |
| PostDeployChecker | 成功、再試行して成功、再試行を使い切って失敗、タイムアウト、出力ファイルがない、読み取りだけ |
| 流れ全体(結合) | 全部成功、事前確認の失敗(`abort` のみ)、承認の拒否、ハッシュの不一致、デプロイの失敗 |

## 実行しないもの

- 実際の AWS へのデプロイ、実際の `cdk synth` と `cdk deploy`。これらは、このステージのテストでは行わない。実際のデプロイは、人の承認を経て、後のステージで行う。

## Sources

- `code-generation-plan.md`
- `aidlc/spaces/default/memory/team.md`(Testing Posture)
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-requirements/tech-stack-decisions.md`(NFR4.1、NFR4.2)

## Assumptions & Open Questions

- Assumptions: `@vitest/coverage-v8` は `vitest` の版(^2)と互換の版を入れる。
- Open questions: None.
