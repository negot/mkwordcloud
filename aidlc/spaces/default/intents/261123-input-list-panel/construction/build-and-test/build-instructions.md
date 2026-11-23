# ビルド手順(入力データ一覧欄)

## 前提
- Node.js 20 以上、依存は `npm install` 済み(ルートの workspaces)。
- 環境変数や外部サービスは不要。AWS には接続しない。

## ビルドコマンド
| 目的 | コマンド |
|---|---|
| 全体のビルド(web、拡張機能、型検査) | `npm run build` |
| web のみ | `npm run build:web` |
| 拡張機能のみ | `npm run build:extension` |
| 型検査のみ | `npm run typecheck` |

## 確認
- `npm run build` が終了コード 0 で終わる。
- `dist/extension` と `dist/wordcloud-extension.zip` が作られる。
- `infra/` は今回変更していないため、`cdk synth` は実行しない(NFR6: テーブルの定義は変えない)。

## よくある問題
- `tsc` が型エラーを出す: `packages/core` の `protocol.ts` と、`server` / `web` の利用側を合わせて確認する。
- web が古い: `npm run build:web` をやり直す。
