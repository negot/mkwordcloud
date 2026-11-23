# 技術選定

既存のスタックを変えず、デプロイスクリプトに必要なものだけを決める。

| 項目 | 決定 | 理由 | 代替案 | 出典 |
|---|---|---|---|---|
| デプロイスクリプトの言語 | TypeScript(Node 20 以上)。`npm run` から実行する | 既存が TypeScript と Node 20 以上で、vitest による単体テストを書ける。確認プロンプトと承認ログ、事前確認、状態の解析を、テストしやすい形で扱える | bash。短く書けるが、プロンプト、ログ、JSON の解析のテストが書きにくい | [Q7] |
| テスト | vitest(既存) | 既存の仕組みを使い、追加コードの行カバレッジ 80% 以上を確認する | ― | NFR4.1、team.md |
| IaC とデプロイ | AWS CDK v2(既存)。`cdk diff` と `cdk deploy` を使う | 既存のスタックを更新するため | ― | FR1.3 |
| AWS の確認 | AWS CLI または AWS SDK(CloudFormation の状態取得、STS でアカウント確認) | 事前確認(FR3.7)と失敗時の状態表示(FR6.2)に必要。実装時に、既存の依存と照らして選ぶ | ― | FR3.7 |
| 認証 | IAM Identity Center の一時的な認証。権限は管理者権限 | [Q4]、NFR2.1 | 専用ロール(権限を絞る案)。今回は採用しない | [Q4] |
| パイプライン基盤 | 使わない(手元実行) | 要件定義 Q4 の回答 | GitHub Actions、CodePipeline | 要件定義 Q4 |
| Lint と整形 | 導入しない。型検査(`tsc --noEmit`)のみ | team.md の Code Style | ESLint、Prettier | team.md |

## 品質と保守性の要件

| ID | 要件 | 出典 |
|---|---|---|
| NFR4.1 | 追加するコード(デプロイスクリプト)の行カバレッジを 80% 以上とし、テストで確認する。基準を下げて通すことはしない | team.md の Testing Posture、要件定義 NFR4 |
| NFR4.2 | 既存のテスト(`npm test`)が通り続ける。テストはタイムアウト 60 秒の既存設定に従う | 要件定義 NFR4 |
| NFR6.1 | 型検査(`npm run typecheck`)が通る。ESLint と Prettier は導入しない | team.md の Code Style、要件定義 NFR6 |
| NFR3.2 | デプロイ手順(実行方法、前提、承認ログの場所)を README かスクリプトのコメントに残す | 要件定義 NFR3 |
| NFR3.3 | スクリプトは `npm run` から実行でき、同じコミットから同じ手順でデプロイできる | [Q7]、要件定義 NFR3 |

## 未決事項

- AWS の確認に、AWS CLI を呼ぶか AWS SDK を使うかは、設計(NFR Design 以降)で決める。SDK を使う場合は、新しい依存の追加になる。

## Sources

- `aidlc/spaces/default/codekb/mkwordcloud/technology-stack.md`
- `aidlc/spaces/default/memory/team.md`
- `nfr-requirements-questions.md`(Q4、Q7)

## Assumptions & Open Questions

- Assumptions: 開発者の手元に AWS CLI と Node 20 以上がある。
- Open questions: AWS の確認の実装手段(CLI か SDK か)。
