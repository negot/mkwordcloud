# デプロイ実行 質問票

## Q1. [デプロイ担当] AWSの認証情報がこのシェルから見えません。どうしますか?

デプロイの前に `aws sts get-caller-identity` を実行したところ、次のエラーになりました。

> aws: [ERROR]: An error occurred (NoCredentials): Unable to locate credentials. You can configure credentials by running "aws login".

また、`aws configure list` では、プロファイル、アクセスキー、リージョンがすべて未設定でした。端末では認証できていても、私がコマンドを実行するシェルからは見えていない可能性があります。デプロイ先は、CDK の既定で `ap-northeast-1`(東京)です(`CDK_DEFAULT_REGION` を指定すると変わります)。

- A. 認証情報を使えるようにしてから、続ける(推奨): ログインし直すなどして、私のシェルから認証情報が見えるようにする(例: `aws sso login --profile <プロファイル名>`)。プロファイル名とリージョンが既定と違う場合は、下の `[Answer]:` の後ろに書く(例: `A: profile=workshop, region=ap-northeast-1`)。Kiro を認証済みの端末から起動し直す必要がある場合もある。準備ができたら **done** と送る。確認のコマンドを再実行し、成功してからデプロイする。
- B. デプロイは自分で行う: このステージではデプロイしない。手順は `cd-config.md` のとおり。あなたがデプロイして `cdk-outputs.json` の内容を共有した後で、スモークテストなどの記録だけを作る。
- C. 今回はデプロイを見送る: このステージを「見送り」にして先へ進む(AWS へのデプロイは行わない)。
- X. Other (please specify)

[Answer]:B

(補足: 回答 B のとおり、デプロイは担当者が自分の端末で行った。結果は `deployment-log.md` を参照。)
