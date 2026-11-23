# 信頼性設計

## 可用性と計画停止(Q6 A)

- 計画停止を許す。停止してよい時間帯や事前の周知の決まりは設けない。開発者が都合のよい時に実行し、実行の時刻は承認ログに残る。(NFR5.1)
- 要件定義の NFR5(計画的な停止時間は設けない)と、その前提 A3 は、この決定で緩める。以降は NFR5.1 が優先する。要件定義の文書は、承認済みのため書き換えない。この文書と traceability.json に、置き換えを記録する。
- 停止を前提にした特別な手順は設けない。通常は CloudFront と Lambda の切り替えの範囲で更新する。(NFR5.2)

## 失敗からの復旧(NFR5.3、NFR5.6、NFR5.7)

| 場面 | 設計 |
|---|---|
| 事前確認の失敗 | AWS を変更する前に停止する。失敗した項目と実際の値を表示し、非ゼロで終了する(NFR1.2) |
| ビルド、型検査、テストの失敗 | 以降のステップを実行せず、非ゼロで終了する(NFR1.3) |
| デプロイ中の失敗 | CloudFormation が自動でロールバックする。FailureReporter が、スタックの現在の状態、失敗したリソースとその理由を表示し、非ゼロで終了する |
| ロールバックが詰まった(`UPDATE_ROLLBACK_FAILED`) | 手作業で復旧する。スクリプトは状態を表示するだけで、自動では直さない |
| デプロイ後の自動確認の失敗 | 再試行(30 秒おき、最大 5 回)を経ても失敗したら、失敗した項目を表示して非ゼロで終了する。自動のロールバックはしない |
| 復旧の流れ | 原因を直して再デプロイする。復旧は 1 時間以内を目標とする(NFR5.3) |

## 再試行の方針

- 再試行するのは、デプロイ後の自動確認だけである(Q4 A)。CloudFront の反映待ちによる一時的な失敗を想定している。
- AWS を変更する操作(`cdk deploy`)は、自動では再試行しない。再試行は人の判断で、再度実行することで行う。

## データの耐久性

- DynamoDB、S3、ログは `RemovalPolicy.DESTROY` のままとし、データは使い捨てとして扱う。バックアップや復元は設計しない。
- 置換または削除の差分が出たときは、RiskDetector が検出して警告し、データ消失を承知した確認(ApprovalPrompter)を経たときだけ進む。(FR3.6)

## ヘルスチェック

- デプロイ後の自動確認(HTTP API の応答、表示用 Web の取得)が、デプロイ直後のヘルスチェックを兼ねる。
- 定期的なヘルスチェックは新たに設けない。(既存の監視を変更しない)

## 検証

- 失敗時の表示と終了コードは、`aws` と `cdk` の子プロセスを差し替えた単体テストで確認する。
- ロールバックが詰まった場合の挙動は、手作業の手順を README に残す。

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-requirements/reliability-requirements.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/inception/requirements-analysis/requirements.md`(NFR5、A3)
- `nfr-design-questions.md`(Q4、Q6)

## Assumptions & Open Questions

- Assumptions: 手作業の復旧手順を README に残す。
- Open questions: None.
