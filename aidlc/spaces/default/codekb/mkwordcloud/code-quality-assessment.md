# Code Quality Assessment

| 観点 | 評価 | 根拠 |
|------|------|------|
| 命名 | good | 日本語コメント、要件 ID 参照 |
| 関数サイズ | fair | service.ts が 304 行、handleWsMessage がやや長い |
| エラー処理 | good | 境界で検証し、型付きエラー応答を返す |
| テスト有無 | good | 各 package に vitest のテスト。カバレッジ閾値は未確認 |
| 重複 | fair | parseConfig / backoffDelay / normalizeRoomCode が extension と web(および core)に重複 |
| デッドコード | 未確認 | 網羅的には調べていない |

- **Lint/format**: 設定ファイルなし。型検査は `npm run typecheck`。
- **CI/CD**: パイプラインなし。`npm run deploy` による手動デプロイ。
- **ドキュメント**: README.md、docs/*.html(主催者/参加者ガイド)。
- **Tech debt**: 上記の重複。TODO/FIXME の網羅検索は未実施。
