# Build and Test サマリー

## 全体の状況
- ビルド: 成功(`npm run build`)。
- テスト: 全体で 92 件中 92 件が合格(この作業の 13 件を含む)。
- 準備状況: build-ready: はい / test-ready: はい / deployment-ready: 実機確認が済めば可(デプロイは人が行う操作で、この作業では実行していない)。

## 生成したテスト種別
- 単体テストのみ(Minimal 戦略。統合・性能・セキュリティの追加の手順書は作っていない)。

## カバレッジの見込み
- 要件ごとに 1 件のテストと、コンポーネントごとに正常系 1 件(express の既定)。行カバレッジの下限は定められていない。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|-----------|--------|----------|--------|----------|--------------|---------|
| TC-SUITE | Testing Contract(express) | 既存のテストが緑のまま | 92 件中 92 件が合格 | `npm test` の出力(test-results.md) | build-and-test | Met |
| TC-STRATEGY | Testing Contract(Minimal) | 要件ごとに 1 件、コンポーネントごとに正常系 1 件 | 13 件。FR1.2/1.4、FR2.4/2.6、FR3.1/3.2/3.3 と、`join-logic.ts` の各関数をカバー | `join-logic.test.ts` | build-and-test | Met |
| TC-CI | Testing Contract | CI 実行の義務はこの契約にない | この計画は CI Pipeline を含まない | requirements、plan | - | N/A |
| NFR1 | requirements.md | サーバー、CORS、CSP、スロットルを変更しない | `infra/`、`packages/server/`、`packages/core/` に変更なし。`/join.html`、`/join.js`、`/join.css` がローカルサーバーから 200 | test-results.md の配信の確認(Node) | build-and-test | Met |
| NFR2 | requirements.md | DOM への出力は安全な方法のみ | `join.ts` の出力は `textContent` のみ(コードを確認) | `packages/web/src/join.ts` | build-and-test | Met |
| NFR3 | requirements.md | iOS Safari と Android Chrome の直近 2 メジャーバージョンで動作 | 実機・実ブラウザでは未実行 | なし | build-and-test(実機確認は人) | Unverified |
| NFR4 | requirements.md | JS と CSS の合計が 50KB 未満 | `join.js` 6.8KB と `join.css` 1.7KB で合計 8.5KB | ビルド出力 | build-and-test | Met |
| NFR5 | requirements.md | core のルートを import しない | `join-logic.ts` は `@wordcloud/core/constants` のみ。拡張機能の `protocol.ts` も `/constants` と `/protocol` のみ。ビルドも通る | ビルド成功 | build-and-test | Met |
| NFR6 | requirements.md | 判定ロジックをブラウザなしでテスト可能 | `join-logic.ts` の関数を 13 件の単体テストで確認 | `join-logic.test.ts` | build-and-test | Met |
| FR5.1 | requirements.md | 幅 320px 以上で横スクロールなし | 実ブラウザでは未実行(CSS は設計上対応) | なし | build-and-test(実機確認は人) | Unverified |
| FR5.2 | requirements.md | タップ領域 44×44 CSS px 以上 | 実ブラウザでは未実行(CSS は 48px 以上で設計) | なし | build-and-test(実機確認は人) | Unverified |

## 既知の制限・残件
- 上の 3 件(NFR3、FR5.1、FR5.2)は実ブラウザでしか確認できない。本ステージの失敗とはせず、承認時に伝える(ステージ定義による)。
- `join.ts` の画面処理(参加、送信、再接続)は、型検査とビルドのみで確認している。実際の WebSocket 接続での動作確認は、デプロイ後または実機で人が行う。
- 本番の CloudFront が `/join.html` を返すかは、デプロイ後に確認が必要。
