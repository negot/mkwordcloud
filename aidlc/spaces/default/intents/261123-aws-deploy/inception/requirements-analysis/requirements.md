# 要件定義: mobile-input-form の AWS デプロイ

## Intent Analysis

- 目的: 既存の mobile-input-form アプリ(ワードクラウド)を AWS に安全にデプロイし、再現できる手順にする。[desc] Initial description: Deploy the mobile-input-form app to AWS: design the infrastructure, set up the deployment pipeline and run the deployment
- 種別: 既存コードのインフラ変更と運用手順の整備(ブラウンフィールド、infra スコープ、Standard 深度)。[scope] Workflow-selected scope: infra
- 現状: AWS CDK v2 のサーバーレス構成(API Gateway の HTTP と WebSocket、Lambda、DynamoDB、S3、CloudFront)があり、`npm run deploy` による手動デプロイで、CI/CD はない。(architecture.md、code-structure.md)
- 成功の姿: 承認を挟んだ手順で `WordcloudStack` を ap-northeast-1 に更新でき、デプロイ後の自動確認(API の応答と表示用 Web が開くこと)と、人による画面の確認が通る。成果物は、承認つきの手元実行スクリプトであり、自動パイプラインは作らない。

## Functional Requirements

### FR1 デプロイ対象
- FR1.1 デプロイ対象は `WordcloudStack` の全体とする: バックエンド API、WebSocket、表示用 Web、モバイル入力フォームの静的ファイル。[Q1]
- FR1.2 Chrome 拡張機能の配布(ストア公開など)は対象外とする。[Q1]
- FR1.3 既存の稼働中スタックを同じスタックのまま更新し、既存のデータ(DynamoDB)を引き続き使う。[Q2]

### FR2 インフラ設計
- FR2.1 現行の CDK 定義を確認し、AWS へのデプロイに必要な変更点(権限、設定値、出力)を設計書にまとめる。[desc]
- FR2.2 デプロイ先はアカウント 1 つ、リージョンは ap-northeast-1 とし、環境は `prod` のみとする。[Q3] (team-practices.md の Deployment)
- FR2.3 スタックを更新しても既存データを失わないことを、変更内容(置換や削除になるリソースの有無)の確認で示す。DynamoDB や S3 のリソースが置換または削除される差分が出た場合は、FR3.6 のとおり警告を出してデプロイを一旦停止し、人がデータ消失を承知のうえで進めると確認した場合に限り先に進む。[Q2][R-03][R-10]

### FR3 デプロイ手順(スクリプト)
- FR3.1 CI/CD パイプラインは作らず、手元から実行する承認つきのデプロイスクリプトを用意する。[Q4]
- FR3.2 スクリプトは、デプロイの前に変更内容(`cdk diff` 相当)を表示し、確認プロンプトで人の承認を得てから `cdk deploy` を実行する。承認なしの `--require-approval never` は使わない。確認プロンプトへの回答を承認として扱い、承認の記録(承認ログ)を残す(FR3.5)。[Q6][R-01] (project.md の Mandated)
- FR3.3 承認者は開発者本人とする。[Q6]
- FR3.4 スクリプトは、ビルド、型検査、テスト、デプロイ、出力の反映(`apply-outputs`)の順に実行し、途中で失敗したら止まる。[desc] (team-practices.md の Testing Posture)
- FR3.5 スクリプトは、承認の可否にかかわらずデプロイの試行ごとに承認ログへ 1 行を追記する。内容は、日時(UTC)、承認者(実行ユーザー名)、コミットのハッシュ、デプロイ先のアカウントとリージョン、変更内容の要約、承認結果(承認、拒否)とする。ログはリポジトリ内の git 管理外のファイルに残し、秘密情報を含めない。[R-01]
- FR3.6 スクリプトは、変更内容(`cdk diff` 相当)に DynamoDB または S3 のリソースの置換や削除が含まれていたら、該当するリソースと「データが失われるおそれがある」ことを示す警告を出して、デプロイを一旦停止する。そのうえで、人にデータ消失を承知のうえで進めるかを確認する別の確認プロンプト(通常の承認プロンプトとは別)を出す。人が承知のうえで進めると答えた場合に限り、通常の承認プロンプト(FR3.2)に進む。それ以外の回答、無回答、入力なしの場合は、デプロイせず非ゼロで終了する。警告の表示、確認の回答、結果は承認ログに記録する(FR3.5)。[R-03][R-10]
- FR3.7 スクリプトは、デプロイの前に、デプロイ先のアカウントとリージョン、CDK のブートストラップ(ブートストラップ用スタック `CDKToolkit` が存在し、使える状態であること)、`WordcloudStack` の状態(更新できる状態であること。`UPDATE_ROLLBACK_FAILED` や処理中の状態は不可)を確認する。確認に失敗したら、失敗した項目と実際の値を表示して、承認プロンプトに進まず非ゼロで終了する。[R-04]

### FR4 認証
- FR4.1 AWS への認証は、長期のアクセスキーを使わない一時的な認証(IAM Identity Center など)とする。[Q5]
- FR4.2 認証情報はリポジトリやログに書き出さない。[Q5]

### FR5 デプロイ後の確認
- FR5.1 デプロイ後に自動の確認を行う: HTTP API の応答、表示用 Web が開けること。[Q7]
- FR5.2 確認は画面表示までとし、テストデータの入力(送信)は行わない。テスト用ルームも作らず、本番データには何も書き込まない。(Q7 の「送信から表示まで通ること」の確認は、人の指示で取りやめた)[R-02]
- FR5.3 表示用 Web を開いたあと、画面が正しく表示されているかを人が確認する確認プロンプトを出す。人が OK と答えたら確認を完了とし、スクリプトはその時点で終了する。OK でない場合や、FR5.1 の確認が失敗した場合は、失敗した項目を表示して非ゼロで終了する。[Q7][R-02]
- FR5.4 自動確認の限界を明記する。自動で確認するのは、HTTP API の応答と、表示用 Web が開くことだけである。WebSocket の接続と、送信から表示までの動作(データの送信と反映)は自動では確認しない。これらを含む動作は、人による確認が必要である。[R-09]
- FR5.5 人による確認の範囲と結果は、スクリプトが人に尋ねて記録する。FR5.3 の確認プロンプトの中で、(1) 画面表示、(2) WebSocket の接続、(3) 送信から表示までの動作のそれぞれについて、人が確認したか、確認しなかったか、問題があったかを 1 項目ずつ尋ねる。回答は承認ログ(FR3.5)に、日時と回答者とともに追記する。確認しなかった項目は「未確認」として記録し、デプロイの失敗とはしない。問題ありと答えた項目がある場合は、非ゼロで終了する。[R-11]

### FR6 デプロイの実行
- FR6.1 承認を得たうえで本番(ap-northeast-1)に実際にデプロイし、FR5 の確認が通ることを記録する。[desc]
- FR6.2 デプロイに失敗したときは、スクリプトが `WordcloudStack` の現在の状態(例: `UPDATE_ROLLBACK_COMPLETE`、`UPDATE_ROLLBACK_FAILED`)と、失敗したリソースとその理由を表示し、非ゼロで終了する。そのあと原因を直して再デプロイして復旧する。ロールバックが詰まった場合の復旧は手作業とし、自動化しない。[team-practices.md の Deployment][R-05]

## Non-Functional Requirements

- NFR1 安全性: 本番デプロイは、確認プロンプトで承認されない限り実行されない。承認の有無にかかわらず試行ごとに承認ログが 1 行残る。合否は、承認なしでデプロイが走らないことと、ログに FR3.5 の項目がそろって残ることで判定する。[Q6][R-01]
- NFR2 セキュリティ: 長期の認証情報を使わず、スクリプトやログに秘密情報を残さない。入力テキストを保存・出力しない既存の方針を維持する。[Q5] (architecture.md の Key Design Decisions)
- NFR3 再現性: 同じコミットから、同じ手順でデプロイできる。手順は README かスクリプトのコメントに残す。[desc]
- NFR4 品質: 既存のテストが通り続け、追加するコードの行カバレッジは 80% 以上とする。[team-practices.md の Testing Posture]
- NFR5 可用性: 更新中の停止は、CloudFront と Lambda の通常の切り替えの範囲に収める。計画的な停止時間は設けない。[assumption] 個人利用に近い規模で、数値目標が示されていないため。
- NFR6 保守性: 型検査(`tsc --noEmit`)が通ること。ESLint と Prettier は導入しない。[team-practices.md の Code Style]

## Constraints

- 環境は `prod` のみ(staging なし)。(team-practices.md)
- `RemovalPolicy.DESTROY` の設定は変えない。ただし、FR2.3 のとおり、更新でデータが消える変更になっていないことを確認する。(team-practices.md、Q2)
- 本番デプロイの前に人の承認を挟む(ALWAYS ルール)。(project.md)
- 既存データを使うため、スタック名と物理リソースを置き換える変更は避ける。[Q2]

## Assumptions

- A1 使うアカウントは決まっていて、手元から IAM Identity Center などで認証できる。(根拠: Q3、Q5 の回答。ブートストラップの済み状況は未確認)
- A2 スタックは既に ap-northeast-1 で稼働中で、CDK のブートストラップが済んでいる。(根拠: Q2 の回答)
- A3 NFR5 の可用性は数値目標を置かない。(根拠: 数値の指定がないため)

## Out of Scope

- CI/CD パイプライン(GitHub Actions、CodePipeline)の構築。[Q4]
- Chrome 拡張機能の配布。[Q1]
- staging 環境の追加、カスタムドメイン、監視の追加(Observability)。[desc]
- ESLint、Prettier の導入。(team-practices.md)

## Open Questions

- 手元実行の承認は確認プロンプトで足りるものとし、承認ログを残す。(決定済み: R-01)
- デプロイ後の確認は画面表示までとし、テストデータは送信しない。(決定済み: R-02)
- 現在の稼働状況(スタックの状態、既存データ量、ブートストラップ済みか)は、デプロイ前に実環境で確認する。
- 当初の依頼にあった「デプロイパイプライン」は、Q4 の回答によりスクリプトで満たす。将来 CI/CD が必要になった場合は、別の作業として扱う。

## Sources

- [desc] 依頼文(project-description)
- [scope] infra スコープ
- [Q1]〜[Q7] `requirements-analysis-questions.md` の回答
- `aidlc/spaces/default/codekb/mkwordcloud/business-overview.md`
- `aidlc/spaces/default/codekb/mkwordcloud/architecture.md`
- `aidlc/spaces/default/codekb/mkwordcloud/code-structure.md`
- `aidlc/spaces/default/intents/261123-aws-deploy/inception/practices-discovery/team-practices.md`

## Assumptions & Open Questions

- Assumptions: A1、A2、A3(上の Assumptions)
- Open questions: 上の Open Questions
