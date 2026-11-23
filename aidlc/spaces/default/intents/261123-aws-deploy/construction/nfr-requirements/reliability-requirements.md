# 信頼性要件

## 可用性

| ID | 要件 | 目標 | 出典 |
|---|---|---|---|
| NFR5.1 | 更新中の停止について、計画停止を許す。夜間などに止めてよい。要件定義の NFR5(計画的な停止時間は設けない)は、この回答で緩める。以降はこの NFR5.1 が優先する | 停止時間の数値目標は置かない | [Q2] |
| NFR5.2 | 計画停止を許すが、スクリプトは停止を前提にせず、通常は CloudFront と Lambda の切り替えの範囲で更新する | ― | [assumption] 停止を許す方針でも、通常の更新手順は変えないため |

## 障害からの復旧

| ID | 要件 | 目標 | 出典 |
|---|---|---|---|
| NFR5.3 | デプロイに失敗してアプリが使えなくなった場合、原因を直して再デプロイし、復旧する。復旧までの目標時間は 1 時間以内とする。ロールバックが詰まった場合(`UPDATE_ROLLBACK_FAILED`)の復旧は手作業とし、自動化しない | 1 時間以内 | [Q3]、FR6.2 |
| NFR5.6 | 失敗したときは、スクリプトが `WordcloudStack` の現在の状態と、失敗したリソースとその理由を表示し、非ゼロで終了する | ― | FR6.2 |

## データの耐久性

- DynamoDB、S3、ログは `RemovalPolicy.DESTROY` のままとし、データは使い捨てとして扱う。バックアップや復元(ポイントインタイムリカバリ)は求めない。(team-practices.md の Deployment)
- ただし、更新で DynamoDB や S3 が置換または削除される差分が出たときは、FR3.6 のとおり警告し、データ消失を承知した確認を得たときに限り進める。

## フォールトトレランス

| ID | 要件 | 出典 |
|---|---|---|
| NFR1.2 | 事前確認(FR3.7)のいずれかが失敗したときは、AWS を変更せずに停止する | FR3.7 |
| NFR1.3 | 途中のステップ(ビルド、型検査、テスト)が失敗したときは、以降のステップを実行せず、非ゼロで終了する | FR3.4 |

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/inception/requirements-analysis/requirements.md`(NFR5、FR3.4、FR3.6、FR3.7、FR6.2)
- `aidlc/spaces/default/memory/team.md`(Deployment)
- `nfr-requirements-questions.md`(Q2、Q3)

## Assumptions & Open Questions

- Assumptions: NFR5.2 は質問では決めていない。
- Open questions: None.
