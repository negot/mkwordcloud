# コード生成の要約: 承認つきデプロイスクリプト

## 作ったもの

`npm run deploy` から実行する、承認つきデプロイスクリプト(TypeScript、ESM、`tsx` で実行)。事前確認、ビルドと検証、再確認、テンプレート生成と差分、リスク検出、承認(データ消失の確認と承認プロンプト)、ハッシュの再照合、承認ログ、`cdk deploy`、`apply-outputs`、自動確認、人による確認の順に進む。AWS 上のリソース(`infra/`)は変更していない。実際のデプロイ、`cdk synth`、`cdk diff`、AWS の呼び出しは、このステージでは一度も実行していない(テストは差し替えで行った)。

## 作成、変更、削除したファイル

作成(`scripts/deploy/src/`):
- `exec.ts`(子プロセスを配列引数で実行。シェルを使わない)、`redact.ts`(伏せ字)、`step-timer.ts`(所要時間と 15 分の目安)、`aws-cli.ts`(STS、CloudFormation)
- `approval-log.ts`、`preflight.ts`、`build-verify.ts`、`synth-diff.ts`、`assembly-hash.ts`、`risk-detector.ts`
- `prompter.ts`、`human-check.ts`、`deployer.ts`、`failure-report.ts`、`post-deploy.ts`、`main.ts`

作成(`scripts/deploy/test/`): `helpers.ts`、`common.test.ts`、`approval-log.test.ts`、`preflight.test.ts`、`build-verify.test.ts`、`synth-risk.test.ts`、`prompt.test.ts`、`deploy.test.ts`、`post-deploy.test.ts`、`main.integration.test.ts`、`fixtures/diff-replace.txt`、`fixtures/diff-scaling.txt`、`fixtures/diff-safe.txt`、`fixtures/diff-none.txt`

作成(文書): `docs/deploy.md`

変更:
- `package.json`: `deploy` を `tsx scripts/deploy/src/main.ts` に置き換え(`--require-approval never` を外した)。`test` の対象に `scripts/deploy` を追加。`test:coverage` を追加。`@vitest/coverage-v8` を devDependencies に追加(`npm install -D @vitest/coverage-v8@^2.1.9`、実際に入った版は vitest と同じ 2.1.9 系)。
- `package-lock.json`: 上の install による更新(計画に明記はないが、install の必然の結果)。
- `vitest.config.ts`: `include` に `scripts/deploy/test/**/*.test.ts` を追加。`coverage`(v8、対象 `scripts/deploy/src/**`、行 80% のしきい値)を追加。
- `tsconfig.json`: `include` に `scripts/deploy/src/**/*.ts` と `scripts/deploy/test/**/*.ts` を追加。
- `.gitignore`: `deploy-logs/` と `cdk.out.deploy/` を追加。

削除: なし。変更していないもの: `infra/`、`README.md`、`AGENTS.md`、`feature-mobile-form.md`、`packages/web/src/join*`、`scripts/build-web.mjs`、`cdk.out/`、`scripts/apply-outputs.mjs`。

## 実行方法

- デプロイ: 変更をコミットしてから `AWS_PROFILE=<プロファイル> npm run deploy`(手順は `docs/deploy.md`)。対話できる端末でだけ動く。
- テスト: `npx vitest run scripts/deploy`。カバレッジ: `npx vitest run scripts/deploy --coverage`(`npm run test:coverage` も同じ)。型検査: `npm run typecheck`。

## テストの結果(実測)

- `npx vitest run scripts/deploy`: 9 ファイル、132 件すべて成功。内訳は共通部品 19、ApprovalLog 8、Preflight 19、BuildVerify 5、SynthDiff・AssemblyHash・RiskDetector 17、Prompter・HumanCheck 21、Deployer・FailureReporter 11、PostDeployChecker 11、結合 21(必須の 5 経路を含む)。
- `npx vitest run scripts/deploy --coverage`(単独実行): 終了コード 0、しきい値(行 80%)を通過。`scripts/deploy/src/**` の行カバレッジ 97.94%(文 97.94%、分岐 92.55%、関数 78.04%)。未カバーの行は `main.ts` の実行用の既定配線の一部(`createDefaultDeps` の中の AWS や CDK を呼ぶラムダ)、`post-deploy.ts` 40-41、`preflight.ts` 127-128、`prompter.ts` 81-82 など。
- `npm run typecheck`: エラーなし(終了コード 0)。
- `npm test`(既存のスイート全体と scripts/deploy): 19 ファイル、224 件すべて成功。既存のテストに失敗はなかった。

## 主な実装の判断

- `Runner`(`exec.ts`)を差し替え可能にして、`aws`、`cdk`、`git`、`npm` を実行せずに引数の配列を検証した。シェルは経由しない(`shell: false`、実プロセスのテストでメタ文字が配列のまま渡ることを確認)。
- 承認ログは 1 行 1 回の追記で、書く前に伏せ字を通す。書けないときは例外にせず失敗を返し、`main.ts` が「デプロイしない」に倒す(`start`、`approval`)。
- テンプレート一式のハッシュは、設計どおり(相対パス昇順、「相対パス、改行、内容」)。除外は `synth.lock`(どの階層でも)と直下の `.cache/`。
- 人による確認の回答は `1`(確認した)、`2`(確認しなかった)、`3`(問題があった)。不正な入力と無回答は「確認しなかった」(未確認)として扱い、「確認した」にはしない。
- 確認プロンプトの入力(readline)は、`cdk deploy` が標準入力を使う前に閉じ、人による確認の前に開き直す。CDK の確認と入力を取り合わないため。

## 計画との差異と注意

- **トレーサビリティの生成コマンドが実行できなかった**: `aidlc engine sensor-traceability ...` は、このサブエージェントの権限規則で拒否された(`Blocked by a permission rule`)。そのため `traceability.json` は、`requirements.md` の FR と、設計文書の詳細な NFR ID(NFR1.1 など)から手で作った。`--write-upstream` による `upstream_ids` の突き合わせは未実施である。親のエージェントが同じコマンドを実行して、`upstream_ids` と `OK` の対象を確かめること。
- FR1.2(拡張機能の配布)は要件で対象外のため `Deferred` とした。FR2.1 は前のステージの設計文書を対象にした。NFR5.5 は既存の `infra/test/stack.test.ts`(構成を変えないことの確認)を対象にした。
- CDK の確認で人が拒否したことの検出は、`cdk deploy` の出力に `Aborted by user` があるかで判定する。そのため `cdk deploy` の標準入力は引き継ぎ、標準出力と標準エラーは取得して画面へ流す(`Runner.interactive`)。この判定と、出力を取得しても CDK の確認が働くことは、実際の `cdk deploy` では未確認(このステージでは実行しない)。実デプロイのステージで、最初の実行で確認すること。
- `cdk diff` の出力の形(`[~] AWS::DynamoDB::Table Table <id> replace`、`(requires replacement)`)を想定した検出で、固定のテキストの例でテストした。実際の CDK の版での出力は未確認。
- スタックがまだない(初回)ときは、更新できるとみなす(要件 A2 では既存スタックを想定)。
- `main.ts` の末尾の「直接実行されたときだけ動く」ブロックは `/* v8 ignore start/stop */` でカバレッジの対象から外した。プロセスの起動と `process.exit` だけで、ほかのコードは対象に残している。しきい値は変更していない。
- 計画の「約 45 件の単体テスト」に対して、実際は 132 件。部品ごとに 5 件以上を満たし、境界の場合分けが増えたため。

## 実行しなかったもの(理由つき)

- 実際の `cdk synth`、`cdk diff`、`cdk deploy`、AWS の呼び出し: このステージの制約(デプロイしない)。後のステージで、人の承認を経て実行する。
- `npm run deploy` の実機での通し実行: 未コミットの変更(モバイル入力フォーム関連、`scripts/build-web.mjs`)が残っていて、事前確認で止まるため。これらは人のファイルで、このステージでは触れない。

## 残していること

- 未コミットのモバイル入力フォームの変更をコミットする(人の作業)。実デプロイの前に必要。
- CI はない。team.md の「CI で確認する」は、スクリプトの段階 2 の `npm test` と、`npm run test:coverage` で満たす想定(設計の assumption のまま)。
