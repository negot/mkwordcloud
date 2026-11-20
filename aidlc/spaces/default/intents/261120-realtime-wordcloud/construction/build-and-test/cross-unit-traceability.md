# 要件のカバレッジ(Cross-Unit Final Coverage Gate)

- 判定: **pass**(未カバーの要件 ID は 0)
- 出典: `aidlc engine sensor-traceability --stage build-and-test` の出力。この作業は Unit に分けていない(zero-Unit)ため、担当はすべて Code Generation です。

| 要件 ID | 担当ステージ | 対象ファイル |
|---------|--------------|--------------|
| FR1.1 | code-generation | packages/server/src/service.ts |
| FR1.2 | code-generation | packages/core/src/room.ts |
| FR1.3 | code-generation | packages/server/src/service.ts |
| FR1.4 | code-generation | packages/server/src/dynamo-repository.ts |
| FR1.5 | code-generation | packages/server/src/memory-repository.ts |
| FR1.6 | code-generation | packages/server/test/service.test.ts |
| FR2.1 | code-generation | packages/extension/manifest.json |
| FR2.2 | code-generation | packages/extension/src/popup.ts |
| FR2.3 | code-generation | packages/extension/src/protocol.ts |
| FR2.4 | code-generation | packages/extension/test/protocol.test.ts |
| FR2.5 | code-generation | scripts/build-extension.mjs |
| FR2.6 | code-generation | packages/extension/src/protocol.ts |
| FR3.1 | code-generation | packages/server/src/service.ts |
| FR3.2 | code-generation | packages/core/src/tokenizer.ts |
| FR3.3 | code-generation | packages/core/src/stopwords.ts |
| FR3.4 | code-generation | packages/core/test/tokenizer.test.ts |
| FR3.5 | code-generation | packages/server/src/service.ts |
| FR3.6 | code-generation | packages/server/test/service.test.ts |
| FR3.7 | code-generation | packages/server/src/repository.ts |
| FR4.1 | code-generation | packages/web/src/main.ts |
| FR4.2 | code-generation | packages/web/src/cloud.ts |
| FR4.3 | code-generation | packages/web/src/logic.ts |
| FR4.4 | code-generation | packages/web/src/styles.css |
| FR4.5 | code-generation | packages/web/src/logic.ts |
| FR4.6 | code-generation | packages/web/src/socket.ts |
| FR4.7 | code-generation | packages/web/src/main.ts |
| NFR1.1 | code-generation | packages/server/src/local.ts |
| NFR1.2 | code-generation | scripts/load-test.mjs |
| NFR1.3 | code-generation | scripts/load-test.mjs |
| NFR2.1 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR2.2 | code-generation | packages/server/src/service.ts |
| NFR2.3 | code-generation | packages/core/src/sanitize.ts |
| NFR2.4 | code-generation | packages/core/src/sanitize.ts |
| NFR2.5 | code-generation | packages/core/src/rate.ts |
| NFR2.6 | code-generation | packages/server/src/service.ts |
| NFR2.7 | code-generation | packages/core/src/room.ts |
| NFR2.8 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR3.1 | code-generation | packages/server/src/repository.ts |
| NFR3.2 | code-generation | packages/server/src/dynamo-repository.ts |
| NFR3.3 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR4.1 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR4.2 | code-generation | README.md |
| NFR4.3 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR5.1 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR5.2 | code-generation | scripts/apply-outputs.mjs |
| NFR5.3 | code-generation | infra/lib/wordcloud-stack.ts |
| NFR6.1 | code-generation | packages/server/src/local.ts |
| NFR6.2 | code-generation | vitest.config.ts |
| NFR6.3 | code-generation | scripts/load-test.mjs |

## 注記

- 「対象ファイル」は、その要件を実装またはテストしている主なファイルです。
- ブラウザでの動作(FR2.2〜FR2.4 の画面操作、FR4.2〜FR4.4 の描画)は、Node 上のロジックのテストまでで、実際のブラウザでは確認していません。
