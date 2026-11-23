# 性能要件

対象: 承認つきデプロイスクリプト(`WordcloudStack` の更新)。アプリ本体の性能は変えない。

## 要件

| ID | 要件 | 目標 | 出典 |
|---|---|---|---|
| NFR3.4 | デプロイスクリプト全体(ビルド、型検査、テスト、事前確認、デプロイ)の所要時間 | 15 分以内。人の確認プロンプトの待ち時間は含まない | [Q1] |
| NFR3.5 | 事前確認(FR3.7)と差分表示(FR3.2、FR3.6)は、承認プロンプトを出す前に完了する | 事前確認と差分表示の合計で 2 分以内 | [assumption] 15 分の枠のうち、人が待たされる前処理を短く保つため |
| NFR3.6 | デプロイ後の自動確認(FR5.1)の所要時間 | 2 分以内。HTTP API の応答と表示用 Web の取得にそれぞれ 10 秒のタイムアウトを設ける | [assumption] |

## 範囲外

- アプリ本体(Lambda、API Gateway、CloudFront)の応答時間や処理量の目標。デプロイで設計を変えないため、現行のまま使う。[Q6]

## 検証

- NFR3.4 は、スクリプトが各ステップの開始と終了の時刻を出力し、合計で判定する。
- 15 分を超えたときは、ステップごとの所要時間を表示して原因を調べる。失敗とはしない。[assumption]

## Sources

- `aidlc/spaces/default/intents/261123-aws-deploy/inception/requirements-analysis/requirements.md`(NFR3、FR3.2、FR3.6、FR3.7、FR5.1)
- `aidlc/spaces/default/codekb/mkwordcloud/technology-stack.md`
- `nfr-requirements-questions.md`(Q1、Q6)

## Assumptions & Open Questions

- Assumptions: NFR3.5 と NFR3.6 の数値は、質問では決めていない。デプロイの規模に合う目安として置いた。
- Open questions: None.
