# コード生成計画: スマートフォン向け簡易入力フォーム

## Summary

- Builds: スマートフォン向けの静的な入力ページ `join.html`(ルームコードで参加し、単語を送信する)
- Touches: `packages/web/src/join.{html,ts,css}`、`packages/web/src/join-logic.ts`、`scripts/build-web.mjs`、`packages/web/test/join-logic.test.ts`
- Tests: 単体テスト約 12 件(vitest、ブラウザなしで動く純粋ロジックのみ)

## 方針
- 既存の表示画面(`main.ts` ほか)、サーバー、CDK(`infra/`)は変更しない(FR4.1、NFR1)。`packages/web/dist` の全体が S3 へ配信されるため、`join.html` を `dist` に出せば同じ CloudFront オリジンから届く。
- 通信の契約は拡張機能と同じ。純粋なヘルパー(`normalizeRoomCode`、`buildWsUrl`、`buildSubmit`、`parseServerMessage`、`describeServerMessage`、`remainingChars`、`backoffDelay`、`parseConfig`、`getOrCreateClientId`)は `packages/extension/src/protocol.ts` から相対 import で再利用し、複製しない。このファイルは `chrome` API に依存しない。import 先は `@wordcloud/core` の `/protocol` と `/constants` のサブパスのみ(NFR5)。
- UI は素の DOM + `data-testid`。画面の文言は日本語。JS は外部ファイル `join.js`(CSP `script-src 'self'`、FR4.2)。
- ブラウザ側の保存先は `localStorage`(FR3.1、FR3.2)。保存できない環境(プライベートモード等)では、メモリ上の値に切り替えて動作を続ける。

## 実装ステップ

- [x] **Step 1** プロジェクト構成と本番設定の骨組み: `scripts/build-web.mjs` に `join.ts` のバンドル(`dist/join.js`)と `join.html`、`join.css` のコピーを追加する。(FR4.1、FR4.2)
- [x] **Step 2** 既存のテストランナー(vitest、ルートの `vitest.config.ts`)を確認し、この Unit 用のコマンドを `unit-test-instructions.md` に記録する。
- [x] **Step 3** ビジネスロジックの実装: `packages/web/src/join-logic.ts`
  - `roomFromSearch(search)`: `?room=CODE` からコードを取り出し、`normalizeRoomCode` で正規化する。不正なら空文字。(FR1.2、FR1.4)
  - `createLocalStore(storage)`: `KeyValueStore` を `localStorage` で実装する。例外時はメモリ上の値を使う。(FR3.1、FR3.2)
  - `validateRoomCode(code)`: 空、または 8 文字ではない場合のメッセージを返す。(FR1.2、FR1.3)
  - 拡張機能の純粋ヘルパーを再 export する。(FR2.2〜FR2.6、FR3.3)
- [x] **Step 4** ビジネスロジックのテスト作成と実行: `packages/web/test/join-logic.test.ts`(要件ごとに 1 件、コンポーネントごとに正常系 1 件)
- [x] **Step 5** フロントエンド(画面)の実装:
  - `packages/web/src/join.html`(参加セクション、送信セクション、`data-testid` 付き、`viewport` メタタグあり)(FR1.1、FR2.1、FR5.1)
  - `packages/web/src/join.css`(モバイル向け、タップ領域 44px 以上、`[hidden]` 対応)(FR5.1、FR5.2)
  - `packages/web/src/join.ts`(参加、`ack`/`error`/`ended` の処理、自動再接続、接続状態表示、文字数カウンター。DOM への出力は `textContent` のみ)(FR1.1〜FR1.4、FR2.1〜FR2.6、FR3.1〜FR3.3、FR5.3、NFR2)
- [x] **Step 6** フロントエンドの動作確認: `npm run build:web` と `npm run typecheck` が通ること、`dist/` に `join.html`、`join.js`、`join.css` が出ること、`join.js` と `join.css` の合計が 50KB 未満であることを確認する。(NFR4、FR4.1)
- [x] **Step 7** ローカル開発サーバー(`npm run dev`)で `/join.html?room=<CODE>` が配信されることを確認する。`local.ts` は `dist` 内の静的ファイルをそのまま配信するため、コードの変更は不要の想定。
- [x] **Step 8** ドキュメントとトレーサビリティ: `code-summary.md`(使い方、仮置きの確認結果を含む)と `traceability.json` を作成する。

## Assumptions
データモデル(テーブル、列、フィールド)の追加はありません。

## 要件との対応
| 要件 | ステップ |
|------|----------|
| FR1.1、FR1.3 | Step 5 |
| FR1.2、FR1.4 | Step 3、Step 4、Step 5 |
| FR2.1〜FR2.5 | Step 5(契約の再利用は Step 3) |
| FR2.6 | Step 3、Step 4、Step 5 |
| FR3.1、FR3.2 | Step 3、Step 4、Step 5 |
| FR3.3 | Step 3、Step 5 |
| FR4.1〜FR4.3 | Step 1、Step 5、Step 6 |
| FR5.1〜FR5.3 | Step 5 |
| NFR1 | 全体(サーバーと CDK は変更しない)、Step 7 |
| NFR2 | Step 5 |
| NFR3 | Step 5(使用する API を iOS Safari と Android Chrome の標準機能に限る) |
| NFR4 | Step 6 |
| NFR5 | Step 3 |
| NFR6 | Step 3、Step 4 |

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:93cc30bfac56d027325cddc54558e948a7b3c5795d8b95fdf54be9cef18eb687",
  "contract_sha256": "sha256:55ed9576f1182de0615d887392d7d201fa1b6dc3599767f7260b15939c91944b"
}
```
