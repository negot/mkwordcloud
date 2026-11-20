# テスト結果

## ビルド

| コマンド | 結果 |
|----------|------|
| `npm run build`(Web・拡張機能のバンドル、型チェック) | 成功(終了コード 0) |
| `npm run synth`(CDK テンプレートの生成、Lambda の esbuild バンドル) | 成功(終了コード 0)。AWS へのアクセスなし |

## 単体テスト

コマンド: `npx vitest run packages/core packages/server packages/web packages/extension infra`

- 合計 78件、成功 78件、失敗 0件、スキップ 0件(9ファイル)。終了コード 0。

| ファイル | 件数 |
|----------|------|
| packages/core/test/sanitize.test.ts | 6 |
| packages/core/test/room-rate.test.ts | 6 |
| packages/core/test/tokenizer.test.ts | 5 |
| packages/server/test/repository.test.ts | 13 |
| packages/server/test/service.test.ts | 16 |
| packages/server/test/api.test.ts | 6 |
| packages/web/test/logic.test.ts | 8 |
| packages/extension/test/protocol.test.ts | 10 |
| infra/test/stack.test.ts | 8 |

## カバレッジ

- 行カバレッジの床は定められていないため、カバレッジ計測は実行していません。

## 失敗

- なし。

## 実行していないもの

- 実際のブラウザでの確認(Chrome への拡張機能の読み込み、ワードクラウドの描画)。ブラウザ関連のテストは Node 上で実行している。
- `cdk deploy` と AWS 上での動作確認、AWS 上の負荷試験。
- この段階でのローカルサーバーの負荷試験の再実行(Code Generation で実行済み: 100クライアント・20秒、570件、取りこぼし 0、p95 1ms)。この環境ではサーバーを長時間起動できなかったため、再実行していない。
