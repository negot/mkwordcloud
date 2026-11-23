# NFR Requirements 質問

対象: mobile-input-form の AWS デプロイ(承認つきの手元実行スクリプト、既存スタックの更新)。要件定義で決まった事項(承認ログ、停止ルール、確認の範囲、一時的な認証)は、そのまま引き継ぎます。数値の目標が決まっていない次の 7 点を確認させてください。機能の設計ステージ(Functional Design)はこのプランに含まれないため、要件定義と既存コードの情報から整理します。

## Q1. [運用] デプロイスクリプトの所要時間
デプロイスクリプト全体(ビルド、型検査、テスト、事前確認、デプロイ)は、どのくらいの時間で終わる必要がありますか。(人の確認プロンプトの待ち時間は含みません)

A. 15 分以内
B. 30 分以内
C. 時間の目標は設けない
X. Other (please specify)

[Answer]:A

## Q2. [運用] 更新中に許せる停止時間
スタックを更新している間、利用者がアプリを使えない時間はどこまで許せますか。

A. 停止なし(CloudFront と Lambda の通常の切り替えの範囲。目安として 1 分未満)
B. 数分程度までは許せる
C. 夜間などに止めてよい(計画停止あり)
X. Other (please specify)

[Answer]:C

## Q3. [運用] デプロイに失敗したときの復旧目標
デプロイに失敗してアプリが使えなくなった場合、どのくらいの時間で復旧する必要がありますか。(復旧は、原因を直して再デプロイする方式です)

A. 1 時間以内
B. 1 営業日以内
C. 時間の目標は設けない
X. Other (please specify)

[Answer]:A

## Q4. [セキュリティ] デプロイに使う AWS の権限
デプロイに使う AWS の権限は、どこまで絞りますか。(CDK のデプロイは CloudFormation、IAM、Lambda、API Gateway、DynamoDB、S3、CloudFront などを操作します)

A. 管理者権限(AdministratorAccess)を IAM Identity Center で一時的に使う。権限は絞らない
B. このスタックの操作に必要な権限だけを持つ専用のロールを作り、それで一時的にデプロイする
X. Other (please specify)

[Answer]:A

## Q5. [セキュリティ] 承認ログの保管
承認ログ(誰が、いつ、どの変更を承認したか)は、どう保管しますか。

A. リポジトリ内の git 管理外のファイルに残す。保管期間は決めない
B. リポジトリ内の git 管理外のファイルに残し、90 日分を保管する(古いものは消す)
C. git で管理し、リポジトリの履歴に残す
X. Other (please specify)

[Answer]:A

## Q6. [運用] 想定する利用規模
今回のデプロイでは、アプリの利用規模(同時に使う人数、部屋の数)の設計を変えますか。(現状は DynamoDB のオンデマンド課金と Lambda で、利用に応じて自動で増減します)

A. 変えない。現行のスケーリングのまま使う
B. 変える(同時に使う人数や部屋の数の目標を Other に記入)
X. Other (please specify)

[Answer]:A

## Q7. [開発] デプロイスクリプトの作り方
デプロイスクリプトは、何で書きますか。(確認プロンプト、承認ログ、事前確認、AWS の状態確認を扱います。既存は TypeScript と Node 20 以上で、`npm run deploy` から呼びます)

A. TypeScript(Node)で書き、`npm run` から実行する(既存のテストの仕組みで単体テストを書ける)
B. シェルスクリプト(bash)で書く
X. Other (please specify)

[Answer]:A


## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
