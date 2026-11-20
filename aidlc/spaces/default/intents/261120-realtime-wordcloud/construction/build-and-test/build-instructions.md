# ビルド手順

## 前提

- Node.js 20以上(動作確認は Node.js 24)、npm 10以上。
- AWSの認証情報は、ビルドとテストには不要です(`cdk deploy` にのみ必要)。

## 依存関係のインストール

```bash
npm install
```

## ビルド

```bash
npm run build
```

内訳:

- `npm run build:web`: 表示ページを `packages/web/dist` にバンドルします。
- `npm run build:extension`: 拡張機能を `dist/extension` にバンドルし、`dist/wordcloud-extension.zip` を作ります。接続先は既定でローカルです。AWS向けは、デプロイ後に `npm run apply-outputs` で作り直します。
- `npm run typecheck`: `tsc --noEmit -p tsconfig.json` で全パッケージの型を検査します。

## インフラの静的検査

```bash
npm run synth
```

CDKのテンプレートを生成し、Lambdaを esbuild でバンドルします(AWSへのアクセスは行いません。`cdk deploy` は実行しません)。

## ビルドの確認

- `packages/web/dist/index.html`、`main.js`、`styles.css` があること。
- `dist/extension/manifest.json`、`popup.js`、`config.json` と、`dist/wordcloud-extension.zip` があること。
- `npm run synth` がエラーなく完了すること。

## 困ったとき

- `kuromoji` の辞書が見つからない場合は、`npm install` をやり直してください(`node_modules/kuromoji/dict` が必要です)。
- `cdk synth` で資産のバンドルに失敗する場合は、`node_modules` を削除して `npm install` をやり直してください。
