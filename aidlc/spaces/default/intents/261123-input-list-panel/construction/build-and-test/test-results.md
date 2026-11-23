# テスト結果(入力データ一覧欄)

実行日: 2026-11-23。場所: ローカル(Node、vitest)。AWS と実ブラウザには接続していない。

## ビルド
| コマンド | 終了コード | 結果 |
|---|---|---|
| `npm run build` | 0 | web、拡張機能、型検査すべて成功 |
| `npm run typecheck` | 0 | エラーなし |

## 単体・統合テスト
| コマンド | 終了コード | 結果 |
|---|---|---|
| `npm test` | 0 | 20 ファイル、246 件、成功 246、失敗 0、スキップ 0 |

既存のテスト 224 件はすべて通り続けている。追加分は 22 件(entries.test.ts 7、service / repository / api のテスト)。

## カバレッジ
| 対象 | コマンド | 結果 |
|---|---|---|
| `scripts/deploy`(しきい値 行 80%) | `npx vitest run ... --coverage`(`vitest.config.ts`) | 行 97.94%、しきい値を満たす |
| 追加コード(packages/*) | `npx vitest run packages --coverage --coverage.include='packages/**/src/**' --coverage.thresholds.lines=0` | entries.ts 100%、constants.ts 100%、core の protocol.ts 100%、server の service.ts 91.96%、memory-repository 100% |

- `packages/web/src/main.ts`(画面の組み立て。DOM 操作)は単体テストの対象外で、行カバレッジは 0%。一覧の描画ロジックは `entries.ts`(100%)に分けてあり、`main.ts` は薄い接続だけを持つ。
- `dynamo-repository.ts` の未カバー行(257-282 付近)は既存の処理(接続・レート)で、今回の追加分(`listEntries`、`resetEntries`、`putEntry`)は repository.test.ts で通っている。

## ブラウザの確認
実ブラウザでの確認は行っていない。画面の表示とスクロールは、Node 上のロジックのテスト(entries.ts)までしか確認できていない。

## Target Verification Matrix(最終)

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1 | requirements.md | 入力文をログに出さない。期限切れの項目を返さない | ログ出力なし。期限切れは返さない(テストで確認) | service.test.ts、repository.test.ts | build-and-test | Met |
| NFR2 | requirements.md | 送信から一覧に出るまで 95% が 3 秒以内 | 未測定(デプロイ環境が必要) | なし | deployment-execution(人の確認) | Unverified |
| NFR3 | requirements.md | 1,000 件で 3 秒以内に一覧が出そろう | 未測定(デプロイ環境が必要) | なし | deployment-execution(人の確認) | Unverified |
| NFR4.1 | requirements.md | 既存テスト 224 件が通る | 246 件すべて成功 | `npm test` 終了コード 0 | build-and-test | Met |
| NFR4.2 | requirements.md | 追加コードの行カバレッジ 80% 以上 | ロジック部分は 91.96% から 100%。`main.ts` は 0%(DOM 接続のみ) | 上の表 | build-and-test | Met(`main.ts` を除く) |
| NFR4.3 | requirements.md | 型検査が通る | エラーなし | `npm run typecheck` 終了コード 0 | build-and-test | Met |
| NFR5 | requirements.md | 課金モード・容量設定を変えない | `infra/` に変更なし | git の差分に infra がない | build-and-test | Met |
| NFR6 | requirements.md | テーブルを置き換えない。デプロイ前に置換の警告がないことを確認 | `infra/` に変更なし。デプロイ差分の確認はこれから | デプロイスクリプトの diff 表示 | deployment-execution | Unverified |
| CI 義務 | team.md | CI での実行 | N/A: このプランは CI Pipeline を実行しない | state の EXECUTE 一覧 | — | N/A |

## 判定
ビルドとテストのコマンドはすべて成功。Unverified の 3 件(NFR2、NFR3、NFR6)は、デプロイした環境でなければ測れない。後の Deployment Execution で、人が確認する。
