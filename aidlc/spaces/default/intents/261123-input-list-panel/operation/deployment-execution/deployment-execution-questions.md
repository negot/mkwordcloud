# デプロイ実行の質問(入力データ一覧欄)

事前確認: AWS にサインイン済み(アカウント下4桁 8292、ロール AWSReservedSSO_AdministratorAccess、プロファイル linked1、ap-northeast-1)。
前回のデプロイと同じ手順で、承認つきのデプロイスクリプトを、あなたの端末で実行します。

## Q1. 変更のコミット

デプロイスクリプトは、コミットされていない変更があると中止します。今回の変更(`packages/*`、`docs/*`、`aidlc/`)をコミットしてよいですか。チームの決まりは、`main` に直接、英語の短い 1 行のメッセージです。

A. はい。コミットしてください(メッセージ案: "Add input list panel with 24h stored entries")
B. 自分でコミットする
X. Other (please specify)

[Answer]:A

## Q2. デプロイの実行

実行するコマンド(あなたの端末で):

`env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=linked1 npm run deploy`

差分に DynamoDB と S3 の置き換えや削除の警告が出たら、承認せずに止めて、私に知らせてください(今回は `infra/` を変えていないので、出ないはずです)。

A. コミット後に、自分で実行する
X. Other (please specify)

[Answer]:A

## Q3. デプロイ後の確認(人の確認 3 項目)

デプロイ後、スクリプトが人の確認を 3 項目で聞きます。次の内容で確認します。

1. 画面を開くと、上半分にワードクラウド、下半分に入力の一覧が出る
2. スマホ(join.html)から送った文が、一覧の一番上に現れる(受信時刻つき)
3. 画面を再読み込みしても、一覧が残っている。リセットすると、ワードクラウドと一覧の両方が消える

テスト用の文を送ってよいですか(送った文は、24 時間保存されます)。

A. 送ってよい(確認が終わったら、リセットで消す)
B. 送らない。画面の表示だけ確認する
X. Other (please specify)

[Answer]:A
