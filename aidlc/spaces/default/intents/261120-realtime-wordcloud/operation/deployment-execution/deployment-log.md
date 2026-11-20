# デプロイ実行ログ

## 概要

- 実行者: プロジェクトの担当者(自分の端末で実行。質問票 Q1 の回答は B「デプロイは自分で行う」)。AI-DLC を動かすシェルには AWS の認証情報が無かったため、デプロイの実行は担当者が行い、その出力を共有してもらった。
- 現在の対象: スタック `WordcloudStack`、アカウント `********8292`、リージョン `ap-northeast-1`(東京)。
- 方法: `cd-config.md` のとおり、手動デプロイ・単一環境。

## 経過

| 手順 | 結果 |
|------|------|
| `npm install`、`npm test`(78件成功)、`npm run build` | 成功 |
| `npx cdk bootstrap` | 成功。ただし `us-east-1` で行われた(AWS CLI の既定リージョンが使われたため) |
| `npm run deploy`(1回目、`us-east-1`) | **失敗**。API Gateway の CORS 設定が `chrome-extension://...` の Origin を受け付けない(`Invalid format for origin`)。CloudFormation が自動で巻き戻した |
| 修正1 | `infra/lib/wordcloud-stack.ts` から API Gateway の `corsPreflight` を外し、各パスに `OPTIONS` ルートを追加。CORS の許可判定は Lambda 側(`handleRest`)の `ALLOWED_ORIGINS` で行う。`infra/test/stack.test.ts` を更新 |
| 修正2 | スタックの Description が `???` と表示されたため、英語に変更(`infra/bin/app.ts`) |
| `npm run deploy`(2回目、`us-east-1`) | 成功。スモークテストも合格 |
| 変更依頼 | 担当者が、東京へのデプロイし直しを依頼 |
| 修正3 | `infra/bin/app.ts` のリージョンを、AWS CLI の既定ではなく環境変数 `WORDCLOUD_REGION`(未設定なら東京)で決めるように変更。README と `cd-config.md` を更新 |
| 東京で `cdk bootstrap` | 成功 |
| `npm run deploy`(3、4回目、東京) | **失敗**。CloudFront の `OriginAccessControl` と `ResponseHeadersPolicy` は、アカウント全体で名前が一意で、`us-east-1` のスタックと衝突した(`already exists`)。自動で巻き戻した |
| `WORDCLOUD_REGION=us-east-1 npx cdk destroy ... --force` | 成功。`us-east-1` のスタックを削除 |
| `npm run deploy`(5回目、東京) | **成功**。所要時間 250.26秒 |

## デプロイの出力(公開されるURL)

| 項目 | 値 |
|------|-----|
| WebUrl | https://d1l71d169uog3u.cloudfront.net |
| ApiUrl | https://xq44axtoqf.execute-api.ap-northeast-1.amazonaws.com |
| WsUrl | wss://j7bpxg1uvk.execute-api.ap-northeast-1.amazonaws.com/prod |
| ExtensionId | bdakebdbelanamofgcgnjhdnkifbodpd |

## 教訓

- 同じ名前のスタックを、2つのリージョンに同時には置けない(CloudFront の名前の衝突)。リージョンを移すときは、先に元のスタックを削除する。
- `us-east-1` のブートストラップ用スタック(`CDKToolkit`)は残っている。費用はほぼかからない。不要なら AWS コンソールの CloudFormation で削除できる。

## 未実施・未タグ

- 東京へのデプロイの後の `npm run apply-outputs` は、まだ実行の報告がない。実行しないと、拡張機能ZIPは削除済みの `us-east-1` の接続先のままになる。
- Git のタグ `deploy-YYYYMMDD-N` は、まだ付けていない。実ブラウザでの確認に成功した後に、担当者が付ける。
