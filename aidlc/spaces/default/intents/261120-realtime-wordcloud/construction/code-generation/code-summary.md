# コード生成の概要

## 作ったもの

| 領域 | 場所 | 内容 |
|------|------|------|
| 共通ロジック | `packages/core` | 定数、サニタイズ、ルームコード/主催者キー、レート制限、語分割(kuromoji)、プロトコル型と日本語エラー文言 |
| サーバー | `packages/server` | `Repository`(インメモリ/DynamoDB)、サービス層(REST/WebSocket)、Lambda アダプター、ローカルサーバー |
| 表示ページ | `packages/web` | ホーム・主催者操作・ワードクラウド表示(d3-cloud、SVG)、自動再接続 |
| 拡張機能 | `packages/extension` | MV3、ポップアップのチャットUI、匿名 clientId、直近ルームの保存 |
| インフラ | `infra` | CDK: S3+CloudFront(OAC)、DynamoDB、HTTP API、WebSocket API、Lambda×2、アラーム |
| スクリプト | `scripts` | Web/拡張のビルド、出力の反映、負荷試験 |
| ドキュメント | `README.md` | ローカル起動、デプロイ、配布、運用メモ |

## 検証結果

- `npx vitest run packages/core packages/server packages/web packages/extension infra`: 9ファイル 78件 成功(変更依頼で接続単位のレート制限のテストを1件追加)
- `npx tsc --noEmit -p tsconfig.json`: エラーなし
- `npm run build`: 成功
- `cdk synth`(ダミー環境、esbuild バンドルまで): 成功
- ローカルサーバーで `POST /rooms`、`GET /config.json`: 応答あり
- `node scripts/load-test.mjs --clients 100 --duration 20`(ローカル): 570件送信、取りこぼし 0、p95 = 1ms

## 計画からの差分

- 表示側の snapshot は、接続直後の自動送信ではなく、クライアントが送る `sync` への応答にした(API Gateway は `$connect` の応答前に接続へ送信できないため)。
- 更新(`update`)は、変わった語だけを絶対値で配信し、表示側で統合する。
- `cdk.json` をルートに追加した。
- テストは計画の約40件より多い77件。
- `minimumProtocolVersion`(TLS 1.2)は、CloudFront の既定証明書では効かないため設定していない。
- Lambda ランタイムは、Node.js 20 が非推奨のため Node.js 24(`nodejs24.x`)に変更した(インフラのテストも更新)。

## 実行していないテスト・確認

- 実際の Chrome に拡張機能を読み込んでの操作、ブラウザでのワードクラウド表示の目視確認(この環境ではブラウザを操作できない)。
- `cdk deploy` と AWS 上での動作確認、AWS 上での100人規模の負荷試験、コールドスタートの実測(AWS へはアクセスしない前提のため)。
- 負荷試験はローカルサーバーに対してのみ実行した。

## 変更依頼への対応(接続単位のレート制限)

- `packages/server/src/service.ts` の送信処理で、clientId 単位に加えて、接続ID(`connId`)単位の判定(1秒に1回、1分に20回)を両方満たすようにした。状態は既存の `RATE#<room>#<key>` アイテムの別キー `conn:<connId>` に保存し、新しいデータ項目は増やしていない。
- `packages/server/test/service.test.ts` に、clientId 単位の記録が無くても同じ接続は制限され、別の接続は影響を受けないことを確認するテストを1件追加した。
- 限界: 接続の clientId は接続時に決まるため、clientId を変えるには再接続が必要になる。したがって接続単位の制限は、同じ接続内の連投には効くが、再接続を繰り返す回避は防げない。その場合の防御は API Gateway のスロットリングである。
