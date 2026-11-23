# 要件の網羅(Cross-Unit Traceability)

判定: **pass**(`aidlc engine sensor-traceability --stage build-and-test` の出力。未対応の要件 0 件)。
Unit なし(express)。担当ステージはすべて code-generation。

| ID | 対象ファイル |
|---|---|
| FR1.1 | packages/web/src/styles.css |
| FR1.2 | packages/web/src/entries.ts |
| FR1.3 | packages/web/src/entries.ts |
| FR1.4 | packages/web/src/styles.css |
| FR1.5 | packages/web/test/entries.test.ts |
| FR1.6 | packages/web/src/main.ts |
| FR1.7 | packages/server/test/service.test.ts |
| FR1.8 | packages/web/src/main.ts |
| FR2.1 | packages/server/src/dynamo-repository.ts |
| FR2.2 | packages/server/test/repository.test.ts |
| FR2.3 | packages/server/src/service.ts |
| FR2.4 | packages/server/test/service.test.ts |
| FR2.5 | packages/server/test/service.test.ts |
| FR2.6 | packages/core/src/protocol.ts |
| FR3.1 | packages/web/src/join.html |
| FR3.2 | docs/organizer-guide.html |
| NFR1 | packages/server/test/service.test.ts |
| NFR2 | packages/server/src/service.ts |
| NFR3 | packages/core/src/constants.ts |
| NFR4 | packages/server/test/repository.test.ts |
| NFR5 | packages/server/src/dynamo-repository.ts |
| NFR6 | infra/lib/wordcloud-stack.ts |

ブラウザの動作(FR1.1、FR1.4、FR1.8 の見た目とスクロール)は、実ブラウザでは確認していない。Node 上のロジックのテストまでである。
