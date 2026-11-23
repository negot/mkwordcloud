# デプロイの流れ(承認つきスクリプト)

**このプロジェクトは、自動のパイプライン(GitHub Actions、CodePipeline など)を作らない**。成果物は、開発者が手元で実行する、承認つきのデプロイスクリプトである。(要件定義 FR3.1、Q4)ここでは、そのスクリプトの段階、各段階の関門(gate)、ロールバック、秘密情報の扱いを定める。

## 実行方法

```
npm run deploy
```

`npm run deploy` は、新しいスクリプト(`scripts/deploy/`、TypeScript、`tsx` で実行)を呼ぶ。既存の `cdk deploy ... --require-approval never` を使う経路は残さない。(Q1 A)事前に、IAM Identity Center にサインインして、プロファイルを `AWS_PROFILE` に設定しておく。

## 段階と関門

| 段階 | 内容 | 関門(失敗したとき) | 要件 |
|---|---|---|---|
| 1 事前確認 | 未コミットの変更なし。アカウント(STS)とリージョン。`CDKToolkit` のブートストラップ。`WordcloudStack` の状態が更新できること | AWS を変更せず停止。`abort` 行を記録 | FR3.7、NFR1.2 |
| 2 ビルドと検証 | `npm run build:web`、`npm run build:extension`、`npm run typecheck`、`npm test` を順に実行 | 以降を実行せず停止。`abort` 行を記録 | FR3.4、NFR1.3、NFR4.1、NFR4.2、NFR6.1 |
| 3 再確認 | 追跡対象のファイルが、ビルドとテストの後も変わっていないこと | 変わったファイルを表示して停止 | NFR1.1 |
| 4 テンプレート生成と差分 | `cdk synth --app "npx tsx infra/bin/app.ts" --output cdk.out.deploy` を一度だけ実行。同じ保存先に対して `cdk diff` を実行して差分を表示。保存先のハッシュを計算 | 失敗したら停止 | FR3.2、NFR1.1 |
| 5 リスク検出 | 差分から、DynamoDB と S3 の置換、削除と、スケーリング設定の変更を検出 | 検出は警告のみ。次の段階で扱う | FR3.6、NFR5.4 |
| 6 開始の記録 | `start` 行を承認ログに書く | 書けないときは、デプロイせず、画面に理由を表示して終了 | FR3.5、NFR1.4 |
| 7 承認 | データ消失のおそれがあるときは、まず「承知のうえで進めるか」を尋ねる(7a)。そのあと承認プロンプト(7b) | 拒否または無回答で、デプロイせず終了 | FR3.2、FR3.6、NFR1.1 |
| 8 ハッシュの再照合 | 保存先のハッシュを計算し直し、承認時のものと照合して、結果を人に提示する | 不一致ならデプロイせず終了 | NFR1.1 |
| 9 承認の判断の記録 | `approval` 行を書く | 書けないときは、デプロイせず終了 | NFR1.4 |
| 10 デプロイ | `cdk deploy --app cdk.out.deploy --outputs-file cdk-outputs.json`。`--require-approval never` は付けない。CDK の既定の確認(権限が広がる変更)は残す | 失敗したら、スタックの状態と失敗したリソースを表示し、非ゼロで終了 | FR6.1、FR6.2、NFR5.6、NFR5.7 |
| 11 出力の反映 | `npm run apply-outputs` | 失敗したら停止 | FR3.4 |
| 12 自動確認 | `cdk-outputs.json` の URL を使う。HTTP API は存在しない部屋コードへの `GET /rooms/{code}` で 404 を確認(読み取りだけ)。表示用 Web が開くこと。再試行は 30 秒おきに最大 5 回、1 回 10 秒のタイムアウト | 失敗した項目を表示して非ゼロで終了 | FR5.1、NFR3.6 |
| 13 人による確認 | 表示用 Web の URL を画面に表示する(ブラウザは自動では開かない)。画面表示、WebSocket の接続、送信から表示までの動作を、1 項目ずつ尋ねて記録する | 「問題があった」があれば非ゼロで終了。「確認しなかった」は未確認として記録(失敗にしない) | FR5.3、FR5.4、FR5.5、NFR1.5 |
| 14 結果の記録 | `deploy`、`postcheck`、`humancheck`、`end` の行を記録 | 書けないときは画面に警告して非ゼロで終了 | FR3.5 |

## デプロイ戦略

| 項目 | 設計 |
|---|---|
| 方式 | CloudFormation による更新(置き換えのない更新が基本)。blue-green や canary は使わない。サーバーレス構成で、CloudFront と Lambda の通常の切り替えの範囲で更新する。(NFR5.2) |
| 環境の昇格 | なし。`prod` のみ。(Q3 要件定義、team.md) |
| フィーチャーフラグ | 使わない |
| 成果物の管理 | テンプレートは `cdk.out.deploy/`(git 管理外)。出力は `cdk-outputs.json`(git 管理外)。承認ログは `deploy-logs/approvals.jsonl`(git 管理外) |
| 計画停止 | 許すが、決まりは設けない。実行の時刻は承認ログに残る。(NFR5.1) |

## ロールバック

| 場面 | 手順 |
|---|---|
| デプロイ中の失敗 | CloudFormation が自動でロールバックする。スクリプトが状態と失敗の理由を表示する |
| ロールバックが詰まった(`UPDATE_ROLLBACK_FAILED`) | 手作業で復旧する(CloudFormation の「ロールバックを続ける」など)。手順は README に書く。スクリプトは自動で直さない |
| デプロイ後の確認で問題が見つかった | 原因を直して、再度 `npm run deploy` を実行する(前のコミットに戻して再デプロイする方法もある)。復旧は 1 時間以内を目標とする。(NFR5.3) |
| データの復元 | 設計しない。データは使い捨てとして扱う |

## 秘密情報

| 項目 | 設計 |
|---|---|
| AWS の認証 | IAM Identity Center の一時的な認証。長期のアクセスキーは使わない。(NFR2.1) |
| スクリプトの秘密情報 | 持たない。リポジトリ、承認ログ、標準出力に認証情報を書かない。出力は伏せ字にする。(NFR2.3、NFR2.5) |
| アプリの秘密情報 | 該当なし。アプリに秘密情報はない(入力テキストを保存もログ出力もしない)。 |

## 品質の関門(テスト自動化との関係)

| 関門 | 内容 |
|---|---|
| 型検査 | `npm run typecheck` が通る。(NFR6.1) |
| 単体テスト | `npm test` が通る。デプロイスクリプトの追加コードは、行カバレッジ 80% 以上。(NFR4.1、NFR4.2) |
| CDK のテスト | 既存の `infra/test/stack.test.ts`(リソース数、アラーム、ダッシュボード)が通る |
| Lint と整形 | 導入しない。(team.md の Code Style) |

自動のパイプラインがないため、これらの関門はスクリプトの段階 2 で実行する。CI での実行は行わない。team.md の「CI で確認する」は、このプロジェクトではスクリプト内のテストの実行で満たす。[assumption]

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/`(security-design.md、reliability-design.md、observability-design.md、logical-components.md)
- `aidlc/spaces/default/intents/261123-aws-deploy/inception/requirements-analysis/requirements.md`
- `package.json`、`infra/bin/app.ts`
- `infrastructure-design-questions.md`(Q1、Q4、Q5、Q6、Q7)

## Assumptions & Open Questions

- Assumptions: team.md の「80% 以上を必須とし、CI で確認する」は、CI がないため、スクリプトの段階 2 のテストの実行で満たす。
- Open questions: None.
