# Code Quality Assessment

| 観点 | 評価 | 根拠 |
|------|------|------|
| 命名 | good | 日本語コメント、要件 ID 参照 |
| 関数サイズ | fair | service.ts が約 300 行。`handleWsMessage` がやや長い(検証、レート、集計、配信を 1 関数で行う) |
| エラー処理 | good | 境界で検証し、型付きエラー応答を返す。Lambda はエラー名だけをログに出す |
| テスト有無 | fair | core/server は充実。web は純粋関数(logic、join-logic)だけで、main/cloud/socket/api は未テスト |
| 重複 | fair | parseConfig / backoffDelay / normalizeRoomCode が extension と web(および core)に重複 |
| デッドコード | 未確認 | 網羅的には調べていない |

- **Lint/format**: 設定ファイルなし(方針として導入しない)。型検査は `npm run typecheck`。
- **CI/CD**: パイプラインなし。承認つきの `npm run deploy`(ビルド、typecheck、test を通してから承認)による手動デプロイ。
- **カバレッジ**: vitest.config.ts は scripts/deploy/src だけを測り、行 80% の閾値。web、server、core には閾値が無い。チームの方針(80% 以上)は他 package では機械的に確認されていない。
- **ドキュメント**: README.md、docs/deploy.md、docs/*.html(主催者/参加者ガイド)。
- **Tech debt**: 上記の重複。web→extension の相対 import。TODO/FIXME の網羅検索は未実施。

## 「入力テキストを保存・ログ出力しない」の保証の範囲
- コード: service.ts `handleWsMessage` のコメント、ws.ts / http.ts のコメント(本文・主催者キーをログに出さない)。
- テスト: service.test.ts「入力テキストそのものは保存されず、語の回数だけが残る」は `repo.getWords` の結果に元文が含まれないことだけを見る。pusher に送られたメッセージ、`console` 出力、DynamoDB の全項目は検査しない。infra/test/stack.test.ts はログ保持 14 日だけを検査する。scripts/deploy の承認ログは秘密情報と入力テキストを書かない(redact を通す)。
- したがって、`update` や新しいメッセージに文を載せても既存テストは落ちない。この約束を守る検査を、機能の追加と同時に足す必要がある。
