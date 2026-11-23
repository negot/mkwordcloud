# 全体のトレーサビリティ

`aidlc engine sensor-traceability --stage build-and-test` の出力をもとにした。Unit を持たない作業のため、「Unit」は Code Generation の 1 つのまとまりを指す。

**判定: 不合格(1 件が未対応。理由は下記)**

| ID | 対応 | 構築した場所 |
|---|---|---|
| FR1.1 | 対応 | `scripts/deploy/src/preflight.ts` |
| FR1.2 | **未対応** | なし。要件定義で対象外(Chrome 拡張機能の配布) |
| FR1.3 | 対応 | `scripts/deploy/test/preflight.test.ts` |
| FR2.1 | 対応 | `aidlc/.../infrastructure-design/infrastructure-specification.md` |
| FR2.2 | 対応 | `scripts/deploy/src/preflight.ts` |
| FR2.3 | 対応 | `scripts/deploy/src/risk-detector.ts` |
| FR3.1 | 対応 | `package.json` |
| FR3.2 | 対応 | `scripts/deploy/src/main.ts` |
| FR3.3 | 対応 | `scripts/deploy/src/prompter.ts` |
| FR3.4 | 対応 | `scripts/deploy/src/build-verify.ts` |
| FR3.5 | 対応 | `scripts/deploy/src/approval-log.ts` |
| FR3.6 | 対応 | `scripts/deploy/src/risk-detector.ts` |
| FR3.7 | 対応 | `scripts/deploy/src/preflight.ts` |
| FR4.1 | 対応 | `docs/deploy.md` |
| FR4.2 | 対応 | `scripts/deploy/src/redact.ts` |
| FR5.1 | 対応 | `scripts/deploy/src/post-deploy.ts` |
| FR5.2 | 対応 | `scripts/deploy/test/post-deploy.test.ts` |
| FR5.3 | 対応 | `scripts/deploy/src/human-check.ts` |
| FR5.4 | 対応 | `docs/deploy.md` |
| FR5.5 | 対応 | `scripts/deploy/src/human-check.ts` |
| FR6.1 | 対応 | `scripts/deploy/src/deployer.ts` |
| FR6.2 | 対応 | `scripts/deploy/src/failure-report.ts` |
| NFR1 | 対応 | NFR1.1 から NFR1.5(`deployer.ts`、`preflight.ts`、`build-verify.ts`、`approval-log.ts`、`human-check.ts`) |
| NFR2 | 対応 | NFR2.1 から NFR2.6 |
| NFR3 | 対応 | NFR3.1 から NFR3.6(`step-timer.ts`、`docs/deploy.md`、`preflight.ts`、`post-deploy.ts`) |
| NFR4 | 対応 | NFR4.1、NFR4.2(`vitest.config.ts`、`build-verify.ts`) |
| NFR5 | 対応 | NFR5.1 から NFR5.7 |
| NFR6 | 対応 | NFR6.1(`tsconfig.json`) |

## 未対応の要素

- **FR1.2**(Chrome 拡張機能の配布はこの作業の対象外)。要件定義(`requirements.md` の FR1.2)で「対象外」と決めた項目である。実装は作らないのが正しく、不足ではない。承認の画面で、この判定が不合格になる理由として示す。

## Sources

- `aidlc engine sensor-traceability --stage build-and-test` の出力
- `aidlc/spaces/default/intents/261123-aws-deploy/construction/code-generation/traceability.json`

## Assumptions & Open Questions

- Assumptions: FR1.2 は意図した対象外である。
- Open questions: None.
