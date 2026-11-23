# Requirements Analysis 質問

依頼: 「mobile-input-form アプリを AWS にデプロイする。インフラ設計、デプロイパイプラインの構築、デプロイ実行まで行う」
既存コードは AWS CDK のサーバーレス構成(API Gateway、Lambda、DynamoDB、S3、CloudFront)で、CI/CD はなく手動デプロイです。要件を固めるため、次の 7 点を確認させてください。

## Q1. [プロダクト] デプロイの対象範囲
今回のデプロイで AWS に載せる対象はどこまでですか。(既存スタックは、バックエンド API、WebSocket、表示用 Web、モバイル入力フォームの静的ファイルを含みます。Chrome 拡張機能は AWS 上には置かれず、配布は別の手順です)

A. 既存スタックの全体(バックエンド、表示用 Web、モバイル入力フォームの静的ファイル)。Chrome 拡張機能の配布は対象外
B. 既存スタックの全体と、Chrome 拡張機能の設定反映(`apply-outputs`)まで
C. モバイル入力フォームに関わる部分だけ
X. Other (please specify)

[Answer]:A

## Q2. [運用] 今のスタックを AWS に出す状況
`WordcloudStack` は現在 AWS 上で稼働していますか。更新か新規かで、必要な手順と戻し方が変わります。

A. 稼働中。同じスタックを更新する(データも引き続き使う)
B. 稼働中だが、新しいスタックを作って切り替える
C. まだ AWS 上にない。新規に作る
X. Other (please specify)

[Answer]:A

## Q3. [運用] AWS アカウントとリージョン
デプロイ先の AWS アカウントとリージョンはどうなっていますか。(現状の既定は ap-northeast-1 で、アカウントは環境変数 `CDK_DEFAULT_ACCOUNT` から決まります)

A. 既に使うアカウントが決まっていて、リージョンは ap-northeast-1
B. 既に使うアカウントが決まっていて、リージョンは別(Other に記入)
C. アカウントがまだ決まっていない
X. Other (please specify)

[Answer]:A

## Q4. [運用] パイプラインを動かす基盤
デプロイパイプラインは、どの基盤で動かしますか。(ソースを置く場所によって、現実的な選択肢が変わります)

A. GitHub Actions
B. AWS CodePipeline と CodeBuild
C. パイプラインは作らず、承認つきのデプロイスクリプトを手元から実行する
X. Other (please specify)

[Answer]:C

## Q5. [運用] AWS への認証方法
パイプラインや手元から AWS にデプロイするときの認証は、どれにしますか。

A. 長期のアクセスキーを使わず、一時的な認証(GitHub Actions の OIDC、または IAM Identity Center)を使う
B. IAM ユーザーのアクセスキーを使う
C. 今は決められない(後のステージで設計する)
X. Other (please specify)

[Answer]:A

## Q6. [プロダクト] 本番デプロイの承認者
事前の取り決め(本番デプロイの前に人の承認を挟む)について、承認するのは誰ですか。

A. 自分(開発者本人)が承認する
B. 開発者とは別の 1 人が承認する
C. 技術リードとプロダクトオーナーの両方が承認する
X. Other (please specify)

[Answer]:A

## Q7. [品質] デプロイが成功したかの確認方法
デプロイの後で、成功したと判断する確認(スモークテスト)は何をしますか。

A. HTTP API の応答確認と、表示用 Web が開けることの確認
B. A に加えて、WebSocket の接続と、1 件の送信から表示まで通ることの確認
C. 確認は人が画面を見て行う(自動の確認は入れない)
X. Other (please specify)

[Answer]:B

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
