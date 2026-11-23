# 結合テスト手順

Standard の強度で、重要な境界の確認を定める。境界は、デプロイスクリプトと外部のコマンド(`git`、`npm`、`aws`、`cdk`)、ファイル(承認ログ、テンプレートの保存先、`cdk-outputs.json`)、HTTP(自動確認)、人の入力(確認プロンプト)である。

## 自動で実行するもの(AWS に接続しない)

流れ全体の結合テストは、`scripts/deploy/test/main.integration.test.ts`(21 件)にある。外部のコマンド、HTTP、人の入力は差し替え、ファイルは一時ディレクトリで行う。

```
npx vitest run scripts/deploy/test/main.integration.test.ts
```

| 境界 | 確認する経路 |
|---|---|
| 流れ全体 | 全部成功 |
| 事前確認と承認ログ | 事前確認の失敗(`abort` 行だけ)、承認ログに書けないとき(画面表示だけで終了) |
| 承認と記録 | 承認の拒否(`approval` と `end`)、データ消失の確認の拒否、ハッシュの不一致(デプロイしない) |
| デプロイと失敗の報告 | デプロイの失敗(失敗の表示と `end`)、`--require-approval never` を渡さないこと |
| 自動確認と人による確認 | 再試行して成功、再試行を使い切って失敗、「確認しなかった」は失敗にしない、「問題があった」で非ゼロ |

期待する結果: 21 件すべて成功。AWS への通信はない。

## 実環境で確認するもの(Deployment Execution の担当)

次は、実際の AWS と認証情報が必要で、このステージでは実行しない。Deployment Execution の最初に、人の承認を得て確認する。

| 確認 | 手順 | 期待する結果 |
|---|---|---|
| 認証 | IAM Identity Center にサインインし、`AWS_PROFILE` を設定。`aws sts get-caller-identity` | アカウント ID と ARN が返る |
| ブートストラップとスタックの状態 | 事前確認(スクリプトの段階 1) | `CDKToolkit` と `WordcloudStack` が更新できる状態 |
| 実際の差分の形式 | `npx cdk diff --app cdk.out.deploy`(スクリプトの段階 4)の出力を保存し、`scripts/deploy/test/fixtures/` と見比べる | DynamoDB と S3 の置換、削除が検出される形式になっている。違えば検出を直す |
| 保存したテンプレートでのデプロイ | `cdk deploy --app cdk.out.deploy` が、再生成せずに動く | 差分と同じ内容がデプロイされる |
| CDK の確認 | 権限が広がる変更があるとき、CDK の確認が画面に出て、拒否すると中止される | 中止され、`deploy` 行に「CDK の確認で拒否」と記録される |
| 自動確認 | HTTP API の 404 と、表示用 Web が開くこと | 再試行の範囲で成功する |
| 人による確認 | 画面表示、WebSocket の接続、送信から表示までを人が確認 | `humancheck` 行に記録される |

## テストデータと環境

- 自動のテストは、固定の偽の応答だけを使う。本物の認証情報と AWS アカウント ID は使わない。
- 実環境の確認では、データを送信しない(自動確認は読み取りだけ)。送信から表示までの確認は、人が行う。

## カバレッジの目標

- `scripts/deploy/src/**` の行カバレッジ 80% 以上。(実測は `test-results.md`)

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/construction/code-generation/unit-test-instructions.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/logical-components.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/infrastructure-design/cicd-pipeline.md`

## Assumptions & Open Questions

- Assumptions: Deployment Execution で、上の「実環境で確認するもの」を実行する。
- Open questions: None.
