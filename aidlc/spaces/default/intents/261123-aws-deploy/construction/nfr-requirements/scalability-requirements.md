# スケーラビリティ要件

## 方針

今回のデプロイでは、アプリの利用規模(同時に使う人数、部屋の数)の設計を変えない。現行のスケーリングのまま使う。[Q6]

## 現行のスケーリング(変更しない)

- DynamoDB: オンデマンド課金(PAY_PER_REQUEST)で、利用に応じて自動で増減する。
- Lambda と API Gateway: 同時実行数に応じて自動で増減する。
- CloudFront と S3: 静的ファイルを配信する。

## 要件

| ID | 要件 | 出典 |
|---|---|---|
| NFR5.4 | スタックの更新で、DynamoDB、Lambda、API Gateway のスケーリング設定(課金モード、同時実行の予約、スロットル値)を変更しない。差分(FR3.2)にこれらの変更が含まれる場合は、承認プロンプトの前に目立つ形で表示する | [Q6]、FR2.1 |
| NFR5.5 | 利用規模の数値目標(同時に使う人数、部屋の数)は、今回は定めない | [Q6] |

## Sources

- `nfr-requirements-questions.md`(Q6)
- `aidlc/spaces/default/codekb/mkwordcloud/technology-stack.md`
- `aidlc/spaces/default/codekb/mkwordcloud/architecture.md`

## Assumptions & Open Questions

- Assumptions: 現行のスケーリング設定で、想定する利用に足りる。(根拠: Q6 の回答)
- Open questions: None.
