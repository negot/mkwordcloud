# デプロイの手順(承認つきスクリプト)

`npm run deploy` は、承認つきのデプロイスクリプト(`scripts/deploy/`)を実行する。承認なしで AWS を変更する経路はない。(FR3.1)

## 前提

- Node.js 20 以上、AWS CLI v2、このリポジトリの `npm install` が済んでいること。
- AWS には IAM Identity Center の一時的な認証で入る。長期のアクセスキーは使わない。(NFR2.1)
  ```
  aws sso login --profile <プロファイル名>
  export AWS_PROFILE=<プロファイル名>
  ```
- リージョンは環境変数 `WORDCLOUD_REGION`(未設定なら `ap-northeast-1`)。`ap-northeast-1` の形式だけを受け付ける。
- 端末(対話できる環境)で実行する。承認と CDK の確認に人が答えるため、パイプや CI からは実行できない。

## 実行の前に: 変更をコミットする

スクリプトは、**未コミットの変更(未追跡のファイルを含む)があると、AWS に触れる前に停止する**。コミットのハッシュと、デプロイされる内容を一致させるためである。デプロイの前に、変更をコミットしておく。(`deploy-logs/` と `cdk.out.deploy/` は git 管理外のため、この確認の対象外)

## 実行

```
npm run deploy
```

流れ(各段階の時間と結果が画面に出る。目安は合計 15 分以内で、超えても失敗にはならない):

1. 事前確認: 未コミットの変更、アカウントとリージョン、`CDKToolkit`、`WordcloudStack` の状態。
2. ビルドと検証: `build:web`、`build:extension`、`typecheck`、`test`。失敗したら止まる。
3. 再確認: ビルドの後に、追跡対象のファイルが変わっていないこと。
4. テンプレートを一度だけ生成して `cdk.out.deploy/` に保存し、同じものに対する差分を表示する。
5. リスク検出: DynamoDB と S3 の置換・削除、スケーリング設定の変更を警告する。
6. データ消失のおそれがあるときは、先に「承知のうえで進めるか」を尋ねる。そのあと承認プロンプト(`yes` か `y` だけが承認。それ以外は拒否)。
7. 承認の後、テンプレートのハッシュを計算し直して照合する。不一致ならデプロイしない。
8. `cdk deploy` を実行する(`--require-approval never` なし)。権限が広がる変更は、CDK が画面で尋ねる。
9. `npm run apply-outputs`、自動確認、人による確認。

## デプロイの方式

- CloudFormation による更新(置き換えのない更新が基本)。blue-green や canary は使わない。CloudFront と Lambda の通常の切り替えの範囲で更新する。(NFR5.2)
- 計画停止の決まりは設けない。実行の時刻は承認ログ(`ts`)に残る。(NFR5.1)
- AWS 上のリソース構成は変えない。このスクリプトは `infra/` を変更しない。(NFR5.5)

## 承認ログ

- 場所: `deploy-logs/approvals.jsonl`(git 管理外)。1 行 1 件の JSON(JSON Lines)。
- 1 回の実行は同じ `attemptId` の行の組になる。行の種類: `abort`、`start`、`approval`、`deploy`、`postcheck`、`humancheck`、`end`。
- 読み方の例:
  ```
  jq -c '{ts, attemptId, kind, decision, result, exitCode}' deploy-logs/approvals.jsonl
  ```
- `start` の前に止まったときは `abort` だけ。承認の拒否とハッシュの不一致は `approval` と `end`。
- 承認ログに書けないときは、デプロイせず、理由を画面に表示して非ゼロで終了する。
- 秘密情報と入力テキストは書かない。

## 失敗したとき

- デプロイ中の失敗: CloudFormation が自動でロールバックする。スクリプトが、スタックの状態と、失敗したリソースとその理由を表示する。原因を直して、コミットし、再度 `npm run deploy` を実行する。
- 自動確認で失敗した: デプロイは完了している。自動のロールバックはしない。原因を直して再度デプロイするか、前のコミットに戻して再デプロイする。復旧は 1 時間以内を目標とする。(NFR5.3)

### ロールバックが詰まったとき(`UPDATE_ROLLBACK_FAILED`)

スクリプトは自動では直さない。手作業で復旧する。

1. AWS コンソールの CloudFormation で `WordcloudStack` を開き、「イベント」で、ロールバックに失敗したリソースと理由を確認する。
2. 理由を取り除く(例: 手作業で変えたリソースを元に戻す)。
3. 「スタックのアクション」の「ロールバックを続行」を実行する。(CLI: `aws cloudformation continue-update-rollback --stack-name WordcloudStack --region <リージョン>`)
4. 状態が `UPDATE_ROLLBACK_COMPLETE` になったことを確認して、再度 `npm run deploy` を実行する。

## 自動確認の限界(人が確認する項目)

自動確認が見るのは、HTTP API が存在しない部屋に 404 を返すこと(読み取りの GET だけ)と、表示用 Web が開くことだけである。データは送信しない。

次は自動では確認できないので、スクリプトの最後に 1 項目ずつ尋ねられる(URL が画面に出る。ブラウザは自動では開かない)。

1. 画面表示
2. WebSocket の接続
3. 送信から表示までの動作

回答は `1`(確認した)、`2`(確認しなかった)、`3`(問題があった)。「確認しなかった」は未確認として記録され、失敗にはならない。「問題があった」があると非ゼロで終了する。

## テストとカバレッジ

```
npx vitest run scripts/deploy              # このスクリプトのテスト
npx vitest run scripts/deploy --coverage   # 行カバレッジ(80% 未満なら失敗)
npm run typecheck
```
