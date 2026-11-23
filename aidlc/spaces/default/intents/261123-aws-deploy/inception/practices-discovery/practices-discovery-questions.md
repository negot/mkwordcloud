# Practices Discovery 質問

履歴が 3 コミットしかなく、運用のやり方は証拠から推定できませんでした。次の 6 点を確認させてください。

## Q1. [開発] 作業の進め方(ブランチ運用)
今回の AWS デプロイ作業では、これまでと同じように `main` に直接コミットしますか。それとも作業用ブランチを切ってからマージしますか。(現在は `main` のみ、コミット 3 件)

A. `main` に直接コミットする(今までどおり)
B. 作業用ブランチを切り、Pull Request(PR)でレビューしてから `main` にマージする
C. 作業用ブランチを切り、レビューなしで `main` にマージする
X. Other (please specify)

[Answer]:A

## Q2. [開発] 薄い縦断スライスを先に作るか
最初に薄い縦断スライスを作りますか。ウォーキングスケルトンとは、システム全体を端から端まで通る最小限の版を先に作り、各部品がつながることを確かめてから本機能を作る進め方です。(既存アプリは既に ap-northeast-1 で動いているため、省略する案が有力です)

A. 作らない(既存スタックの再デプロイとパイプライン化を直接進める)
B. 作る(パイプラインに「ビルド、synth、デプロイ、スモークテスト」を通す最小版を先に作る)
X. Other (please specify)

[Answer]:A

## Q3. [品質] テストの進め方
今回追加するインフラやパイプラインのコードで、テストはどの順番で書きますか。(現状は vitest のテストがあり、テストを先に書いた痕跡は見つかりませんでした)

A. 実装してからテストを書く(test-after、既定)
B. テストを先に書く(TDD)
C. シナリオ仕様を先に書く(BDD)
X. Other (please specify)

[Answer]:A

## Q4. [品質] カバレッジの基準
行カバレッジの下限を設けますか。(現状は閾値の設定がありません。既定は 80% 以上で、CI での実行も含みます)

A. 80% 以上を必須にし、CI で確認する(既定)
B. 閾値は設けず、既存テストが通ることだけを確認する
X. Other (please specify)

[Answer]:A

## Q5. [運用] 環境の構成と本番へのデプロイ承認
デプロイ先の環境をどうしますか。(現状は `prod` のみで、承認なしの `--require-approval never` で手動デプロイしています)

A. `prod` のみ。デプロイ前に人の承認を挟む
B. `staging` と `prod` の 2 環境。`staging` はマージで自動デプロイ、`prod` は手動承認(既定)
C. `prod` のみ。承認なしで自動デプロイする
X. Other (please specify)

[Answer]:A

## Q6. [運用] データの扱いと戻し方
スタックの DynamoDB、S3、ログは、スタックを削除するとデータも消える設定(`RemovalPolicy.DESTROY`)です。これを本番データとして守りますか。また、デプロイに失敗したときの戻し方はどうしますか。

A. 本番データとして守る(削除時もデータを保持する設定に変更し、失敗時は直前のバージョンに戻す)
B. 今の設定のまま(データは使い捨て。失敗時は再デプロイで直す)
X. Other (please specify)

[Answer]:B

## Q7. [開発] コードスタイルのチェック
Lint と整形(ESLint、Prettier)をパイプラインに入れますか。(現状は型検査 `tsc --noEmit` のみで、設定ファイルはありません)

A. 型検査のみ(今のまま)
B. ESLint と Prettier を導入し、パイプラインで失敗扱いにする
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
