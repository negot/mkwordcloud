# Deployment Execution 質問

## 事前確認の結果(私が実行した、読み取りだけの確認)

| 確認 | 結果 |
|---|---|
| AWS の認証(プロファイル `linked1`、ap-northeast-1) | 成功。アカウント `********8292`、ロール `AWSReservedSSO_AdministratorAccess`(ユーザー `m-yamazaki`) |
| スタック `WordcloudStack` の状態 | `UPDATE_COMPLETE`(更新できる状態) |
| ブートストラップ用スタック `CDKToolkit` の状態 | `UPDATE_COMPLETE`(ブートストラップ済み) |
| データベースの移行 | 必要なし。DynamoDB のテーブルの構成は変えない |
| 依存するサービス | なし(ほかのスタックやサービスには依存しない) |

要件定義で未確認だった前提(スタックが稼働中でブートストラップ済み)は、これで確認できました。

## 実行の方法

デプロイスクリプトは、確認プロンプト(差分の承認、必要ならデータ消失の確認、画面での確認)に人が答える必要があり、この作業の中では答えられません。**あなたの端末で、プロジェクトのルートから次を実行してください。**

```
env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=linked1 npm run deploy
```

実行前に、次を済ませてください(スクリプトは未コミットの変更があると止まります)。

- `aidlc/` の変更をコミットする: `git add aidlc && git commit -m "Record deployment execution progress"`
- 下の Q1 で選んだとおりに、未追跡の 2 ファイルを扱う

## Q1. [運用] 未追跡の 2 ファイルの扱い
`docs/presentation.html` と `feature-mobile-form.md` は、まだ git に入っていません。デプロイスクリプトは、未追跡のファイルがあっても止まります。どうしますか。

A. 2 つともコミットする(`git add docs/presentation.html feature-mobile-form.md`)
B. リポジトリの外に移す(今は不要なファイルとして)
C. `.gitignore` に追加して、git の対象から外す
X. Other (please specify)

[Answer]:C

## Q2. [運用] 実行のタイミング
デプロイを実行するのは、いつですか。(計画停止を許す方針です。実行の時刻は承認ログに残ります)

A. 今すぐ実行する。実行が終わったら、結果を知らせる
B. 後で実行する。この作業は、結果の報告を待って止める
X. Other (please specify)

[Answer]:A

## Q3. [品質] デプロイ後に人が確認する範囲
スクリプトは、自動の確認(HTTP API の 404、表示用 Web が開くこと)のあと、人に次の 3 項目を尋ねます。どこまで確認しますか。(WebSocket と送信から表示までは、自動では確認されません)

A. 3 項目すべてを確認する: 画面表示、WebSocket の接続、送信から表示までの動作(推奨)
B. 画面表示だけを確認する。残りは「確認しなかった」として記録する
X. Other (please specify)

[Answer]:A

## Q4. [運用] 失敗したときの進め方
デプロイや確認が失敗したとき、どう進めますか。(失敗の内容は、スクリプトが画面に表示し、承認ログに残ります)

A. 画面の出力と承認ログを私に共有して、原因を調べて直す(直したら、もう一度実行する)
B. 失敗は自分で調べる。結果だけを知らせる
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
