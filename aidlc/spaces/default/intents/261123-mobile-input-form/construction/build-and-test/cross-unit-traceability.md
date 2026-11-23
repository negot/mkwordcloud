# 要件のカバレッジ(zero-Unit)

`aidlc engine sensor-traceability --stage build-and-test` の結果: **pass**(未カバーの ID なし)。

| ID | 判定 | 対象ファイル |
|----|------|--------------|
| FR1.1 | 合格 | packages/web/src/join.ts |
| FR1.2 | 合格 | packages/web/test/join-logic.test.ts |
| FR1.3 | 合格 | packages/web/src/join.ts |
| FR1.4 | 合格 | packages/web/test/join-logic.test.ts |
| FR2.1 | 合格 | packages/web/src/join.html |
| FR2.2 | 合格 | packages/web/src/join.ts |
| FR2.3 | 合格 | packages/web/src/join.ts |
| FR2.4 | 合格 | packages/web/test/join-logic.test.ts |
| FR2.5 | 合格 | packages/web/src/join.ts |
| FR2.6 | 合格 | packages/web/test/join-logic.test.ts |
| FR3.1 | 合格 | packages/web/test/join-logic.test.ts |
| FR3.2 | 合格 | packages/web/test/join-logic.test.ts |
| FR3.3 | 合格 | packages/web/src/join.ts |
| FR4.1 | 合格 | scripts/build-web.mjs |
| FR4.2 | 合格 | packages/web/src/join.html |
| FR4.3 | 合格 | packages/web/src/join.ts |
| FR5.1 | 合格 | packages/web/src/join.css |
| FR5.2 | 合格 | packages/web/src/join.css |
| FR5.3 | 合格 | packages/web/src/join.html |
| NFR1 | 合格 | scripts/build-web.mjs |
| NFR2 | 合格 | packages/web/src/join.ts |
| NFR3 | 合格 | packages/web/src/join.ts |
| NFR4 | 合格 | scripts/build-web.mjs |
| NFR5 | 合格 | packages/web/src/join-logic.ts |
| NFR6 | 合格 | packages/web/test/join-logic.test.ts |

この表は「対象ファイルがある」ことを示す。実機のブラウザでの動作確認とは別である(FR5.1、FR5.2、NFR3 は `build-and-test-summary.md` の Unverified を参照)。
