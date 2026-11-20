# Build and Test サマリー

## 全体の状況

- ビルド: 成功(`npm run build`、`npm run synth`)。
- 単体テスト: 9ファイル・78件すべて成功。
- 前提: Node.js 20以上、`npm install` 済み。AWSの認証情報は不要。

## テスト種別の一覧

| 種別 | 生成した指示書 | 備考 |
|------|----------------|------|
| 単体テスト | Code Generation の `unit-test-instructions.md` | Minimal 戦略。要件ごと・コンポーネントごとに正常系を含む |
| 結合テスト | なし | Minimal 戦略では追加しない。ただし `packages/server/test/api.test.ts` が、ローカルサーバーを起動して WebSocket の往復を確認している |
| 性能・セキュリティ | なし | Minimal 戦略では追加しない |

## カバレッジの見込み

- テストの方針で、行カバレッジの床は定めていません(Minimal 戦略、express スコープ)。
- 各コンポーネント(core、server、web の純粋ロジック、extension の純粋ロジック、infra)に、正常系のテストがあります。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|-----------|--------|----------|--------|----------|--------------|---------|
| N/A-1 | Testing Contract(計画の `code-generation-plan.md`) | CI でのテスト実行(CI Pipeline がある場合のみ) | 該当なし | この計画には CI Pipeline がなく、nfr-requirements と nfr-design の成果物も無いため、測定対象の品質目標は無い | - | N/A |

## 準備状況

- build-ready: はい。
- test-ready: はい(単体テストはすべて成功)。
- deployment-ready: 次の条件つきで、はい。AWS 上での確認はまだです。

## 既知の制限と未確認の事項

- ブラウザの動作は、実際のブラウザでは確認していません。Web の表示ロジックと拡張機能のロジックは Node 上で検証し、画面のレイアウトとワードクラウドの描画、Chrome への拡張機能の読み込みは未確認です。実際のブラウザで確認する必要があります。
- 要件の性能目標(NFR1: 反映3秒以内、約100人)は、ローカルサーバーに対する負荷試験(`scripts/load-test.mjs`)でのみ確認しています。AWS 上での確認と、kuromoji 辞書のコールドスタートの実測は、デプロイ後に必要です。
- `cdk deploy` は実行していません。
