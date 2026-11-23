# ビルド手順

## 前提
- Node.js 20 以上(確認時は v24.17.0)。
- 依存関係は `npm install` で入る(ワークスペース構成)。この作業で依存は追加していない。

## 環境設定
- 環境変数は不要。ローカル確認時、設定の `config.json` は `local.ts` が動的に返す。

## ビルドコマンド
```
npm run build
```
内訳: `build:web`(`scripts/build-web.mjs`、`dist/main.js` と `dist/join.js` を生成し、HTML と CSS をコピー)、`build:extension`、`typecheck`(`tsc --noEmit`)。

## ビルドの確認
- `packages/web/dist/` に `join.html`、`join.js`、`join.css` が出ている。
- `npm run typecheck` がエラーなしで終わる。
- ローカル配信の確認: `npm run dev` で起動し、`http://localhost:3000/join.html?room=<コード>` を開く。

## 問題が出たとき
- `join.js` が `dist` に無い場合: `npm run build:web` を実行する。`dist` は実行のたびに作り直される。
- `@wordcloud/core` の import で `node:crypto` のエラーが出る場合: ブラウザ側のコードが core のルートを import している。`/protocol` と `/constants` のサブパスだけにする(NFR5)。
- 本番(CloudFront)で `join.html` が見えない場合: `npm run deploy` で `dist` 全体が配信される。デプロイは人が行う操作。
