# Build and Test サマリー(入力データ一覧欄)

## 状態
- ビルド: 成功(`npm run build`)。
- テスト: 246 件すべて成功。型検査: エラーなし。
- 強度: Minimal。追加のテスト指示ファイル(integration、performance、security)は作らない。

## テスト種別
| 種別 | 状態 |
|---|---|
| 単体(core、server、web のロジック) | 実施 |
| 統合(api.test.ts、メモリ上のサービス) | 実施(既存のテストに追加) |
| 実ブラウザ | 未実施 |
| 性能、セキュリティ | 作らない(Minimal) |

## カバレッジの見込み
- `scripts/deploy`: しきい値 行 80%(実測 97.94%)。
- 追加コード: ロジック部分は 91.96% から 100%。`main.ts` の DOM 接続は対象外。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1 | requirements.md | 入力文をログに出さない。期限切れを返さない | 満たす | service.test.ts、repository.test.ts | build-and-test | Met |
| NFR2 | requirements.md | 95% が 3 秒以内 | 未測定 | なし | deployment-execution(人の確認) | Unverified |
| NFR3 | requirements.md | 1,000 件で 3 秒以内 | 未測定 | なし | deployment-execution(人の確認) | Unverified |
| NFR4.1 | requirements.md | 既存 224 件が通る | 246 件成功 | `npm test` | build-and-test | Met |
| NFR4.2 | requirements.md | 追加コード 行 80% 以上 | 91.96% から 100%(`main.ts` を除く) | test-results.md | build-and-test | Met |
| NFR4.3 | requirements.md | 型検査が通る | エラーなし | `npm run typecheck` | build-and-test | Met |
| NFR5 | requirements.md | 課金設定を変えない | infra 変更なし | git 差分 | build-and-test | Met |
| NFR6 | requirements.md | テーブルを置き換えない | infra 変更なし。差分の確認はデプロイ時 | デプロイスクリプトの diff | deployment-execution | Unverified |
| CI 義務 | team.md | CI で実行 | N/A(このプランは CI Pipeline を実行しない) | state | — | N/A |

## 準備状況
- build-ready: はい。
- test-ready: はい。
- deployment-ready: 条件つき。変更のコミットと、人によるデプロイ時の確認(DynamoDB / S3 の置換警告がないこと、一覧の表示)が要る。

## 残っている項目
- NFR2、NFR3、NFR6 は、デプロイした環境でないと測れない。Deployment Execution で人が確認する。
- 実ブラウザでの表示とスクロールの確認。
