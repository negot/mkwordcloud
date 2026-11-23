# テスト結果

## ビルド
- `npm run build`: 成功(終了コード 0)。`dist/main.js` 15.3KB、`dist/join.js` 6.8KB、拡張機能のビルド、`tsc --noEmit` がすべて通った。

## 単体テスト(この作業のコマンド)
- `npx vitest run packages/web/test/join-logic.test.ts`: 13 件中 13 件が合格(失敗 0、スキップ 0)。

## 既存を含む全体
- `npm test`: 10 ファイル、92 件中 92 件が合格(失敗 0、スキップ 0)。既存のテストは緑のまま。
- カバレッジの下限は、この作業の Testing Contract(express、Minimal)に定められていない。プロジェクトの設定にも全体の閾値はない。そのためカバレッジ計測は実行していない。

## 配信の確認(Node)
- `startLocalServer({ port: 0 })` を起動し、HTTP で取得した結果: `/join.html?room=ABCD2345` が 200(`text/html; charset=utf-8`)、`/join.js` が 200、`/join.css` が 200。この確認は Node 上の HTTP 取得で、ブラウザでの確認ではない。

## 失敗の詳細
なし。

## 実機・実ブラウザの確認
- 実際のブラウザ(iOS Safari、Android Chrome)では実行していない。画面の動作(`join.ts`)は、型検査、ビルド、純粋ロジックの単体テストでのみ確認している。

## Target Verification Matrix(確定版)
`build-and-test-summary.md` の同名の表を参照。

## Loop-Back Log
なし(ループバックは発生していない)。
