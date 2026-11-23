# スケーラビリティ設計

## 方針

アプリの利用規模の設計は変えない。現行のスケーリング(DynamoDB のオンデマンド課金、Lambda、API Gateway、CloudFront と S3)のまま使う。(NFR5.5)

## 設計

| 項目 | 設計 |
|---|---|
| スケーリング構成 | 変更しない。サーバーレス構成の自動スケールに任せる |
| 変更の検出(NFR5.4) | RiskDetector が、差分に DynamoDB の課金モード、Lambda の同時実行の予約、API Gateway のスロットル値の変更が含まれるかを調べる。含まれるときは、承認プロンプトの前に目立つ形で表示する。承認の可否は、通常の承認プロンプトで人が決める |
| デプロイスクリプト自体 | 一人が手元で一度に一回実行する想定で、並行実行は設計しない。並行して二つ実行されると、承認ログの追記が混ざるため、ロックは設けず、承認ログは 1 行を 1 回の追記で書く(行の途中で混ざらない)。[assumption] |

## 容量の目安(参考)

数値目標は定めない。(NFR5.5)

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-requirements/scalability-requirements.md`
- `aidlc/spaces/default/codekb/mkwordcloud/architecture.md`
- `nfr-design-questions.md`(Q1)

## Assumptions & Open Questions

- Assumptions: デプロイスクリプトは同時に複数起動されない。
- Open questions: None.
