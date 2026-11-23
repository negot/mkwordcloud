# Code Generation Plan: 入力データの一覧欄

## Summary

- Builds: 表示用の画面の下半分に、入力された文を新しい順に並べる一覧欄(スクロールで全件)と、それを支える保存と配信
- Touches: `packages/core`(メッセージの型)、`packages/server`(保存、配信、リセット)、`packages/web`(画面、一覧の処理)、`join.html`、ガイド 2 本。AWS の構成(`infra/`)は変更しない
- Tests: 要件ごとに 1 件を基本とする約 15 件(保存、配信、リセット、画面の一覧の処理)。既存の 224 件は通り続ける

## 対象と方針

- 対象は 1 つのまとまり(Unit なし)。要件は `inception/requirements-analysis/requirements.md` による。
- 既存のコードの書き方に合わせる: TypeScript(ESM)、コメントとメッセージは日本語、要件 ID(FR、NFR)を参照する。ブラウザのコードは `@wordcloud/core/protocol` と `/constants` のサブパスだけを import する。
- テストの順序は test-after: 各層を実装してから、その層のテストを書いて実行する。(Testing Contract)
- Lint と整形は導入しない。型検査(`npm run typecheck`)を通す。
- **このステージでは AWS へのデプロイを実行しない。** デプロイは、後のステージで、承認つきのデプロイスクリプトで、人の承認を経て行う。
- 既存のメッセージ(`snapshot`、`update`、`ack`、`pong`、`ended`、`error`)の意味と形は変えない。(FR2.6)
- 入力された文は、Lambda のログに出さない。(NFR1)

## 設計の要点(コードの前に決めること)

- **データ(DynamoDB、既存のテーブルに項目を足す):** 項目の種類 `ENTRY` を足す。`pk` は `ROOM#<code>`、`sk` は `ENTRY#<受け取った時刻(ミリ秒、13 桁のゼロ埋め)>#<id>`。属性は `id`(一意の識別子。表示側の重複の除去に使う)、`text`(整形済みの入力文)、`at`(受け取った時刻、ミリ秒)、`ttl`(ルームの `ttl` と同じ)。`sk` の時刻順で、新しい順に取り出せる。
- **メッセージ(サーバーから表示用の画面へ):** `{ type: 'entries', items: Entry[], replace: boolean }`(保存済みの文のまとまり。`replace` が真なら、一覧を作り直す。空の `items` と `replace` で、一覧を空にできる)と、`{ type: 'entry', item: Entry }`(新しい 1 件)。`Entry` は `{ id, text, at }`。1 つの `entries` は最大 50 件(1 件は約 300 バイト以内なので、1 つのメッセージは約 17 キロバイトに収まる)。
- **流れ:** 表示用の画面が `sync` を送ると、サーバーは `snapshot` に続けて、保存済みの文を新しい順に 50 件ずつ `entries` で送る(最初のまとまりが `replace: true`)。新しい文が来たら、保存して、接続中の表示用の画面に `entry` を送る。リセットでは、語の集計と文の両方を消し、`snapshot`(空)と `entries`(空、`replace: true`)を送る。
- **画面:** 上半分がワードクラウド、下半分が一覧。一覧は新しい文を先頭に足す。先頭より下を読んでいるときは、足した分だけスクロールの位置をずらして、読んでいる行を動かさない。文は `textContent` で入れる。

## Steps

- [x] **Step 1: テストランナーの確認と、このまとまりの実行コマンドの記録**
  - 既存の vitest が動くことを確認し、このまとまりのコマンドを `unit-test-instructions.md` に記録する。
- [x] **Step 2: メッセージの型と定数(`packages/core`)**
  - `packages/core/src/protocol.ts`: `Entry`(`id`、`text`、`at`)を足し、`ServerMessage` に `entries`、`entry` を足す。
  - `packages/core/src/constants.ts`: `ENTRY_CHUNK_SIZE = 50` を足す。
  - 実装: FR2.3、FR2.4、FR2.6。名前を挙げる要素: `Entry.id`(重複の除去、FR1.5 の位置維持)、`Entry.text`(FR1.2)、`Entry.at`(FR1.2 の時刻)
- [x] **Step 3: データ層(`packages/server`)を実装する**
  - `repository.ts`: `addEntry(code, entry, ttl)`、`listEntries(code)`(新しい順)、`resetEntries(code)` を `Repository` に足す。
  - `memory-repository.ts`: インメモリ版を実装する(期限を過ぎた項目は返さない)。
  - `dynamo-repository.ts`: `ENTRY#` の項目を保存、`ScanIndexForward: false` の Query で全件(ページ送りあり)を新しい順に取り出す、`resetEntries` は `ENTRY#` の接頭辞で削除、読み取り時にも `ttl` を確認する。`deleteRoom` は、パーティション全体を消すので、そのまま文も消える。
  - 実装: FR2.1、FR2.2、FR1.7、NFR1。名前を挙げる要素: `ENTRY#...` の `sk`、`id`、`text`、`at`、`ttl`(上の設計の要点のとおり)
- [x] **Step 4: データ層のテストを書いて実行する**
  - 保存して新しい順に返る、期限切れの項目は返さない、`resetEntries` が文だけを消して語は残す、`deleteRoom` が文も消す(メモリ版と、DynamoDB のモックの両方)。
- [x] **Step 5: 業務ロジック(`packages/server/src/service.ts`)を実装する**
  - `submit`: 検証とレート制限を通った文(整形済み)を、`id` と受け取った時刻(`now()`)とともに保存し、表示用の接続に `entry` を送る。語の集計と `update` は、これまでどおり。語に分けた結果が空でも、文は保存して送る。
  - `sync`: `snapshot` に続けて、保存済みの文を `ENTRY_CHUNK_SIZE` 件ずつ `entries` で送る(空のときも、`replace: true` の 1 つを送る)。
  - リセット(`hostAction`): `resetWords` に加えて `resetEntries` を呼び、`snapshot`(空)と `entries`(空、`replace: true`)を送る。
  - コメント「入力テキストそのものは保存もログ出力もしない」を、新しい方針(24 時間保存する。ログには出さない)に直す。
  - 実装: FR1.7、FR2.1、FR2.3、FR2.4、FR2.5(`sync` と `entry` は表示用の接続だけ。参加者には `ack` だけ)、FR2.6
- [x] **Step 6: 業務ロジックのテストを書いて実行する**
  - 送信で `entry` が表示用の接続だけに届く(参加者には届かない)、文が保存される、語に分けた結果が空でも文は保存される、`sync` で保存済みの文が新しい順に、50 件を超えると分けて届く、リセットで両方が空になる、既存の `update` と `ack` が変わらない。
- [x] **Step 7: API の層(Lambda、ローカルサーバー)を確認する**
  - `lambda/ws.ts`、`lambda/http.ts`、`local.ts` が `service.ts` を呼ぶだけで、入力文をログに出さないことを確認する。出す箇所があれば直す。ローカルサーバーが新しいメッセージを扱えることを確認する。
  - 実装: NFR1、FR2.6
- [x] **Step 8: API の層のテストを書いて実行する**
  - `api.test.ts` に、リセットの API で保存した文が消えること、ルームの終了で文も消えることを足す。
- [x] **Step 9: 画面の一覧の処理(`packages/web/src/entries.ts`、新規)を実装する**
  - 純粋な関数(ブラウザなしでテストできる): `applyEntries(current, message)`(`entries`、`entry` の統合。`id` で重複を除く。先頭に新しい順で保つ)、`formatTime(at)`(時:分:秒)、`adjustScroll(oldTop, oldHeight, newHeight)`(先頭より下を読んでいるときだけ、足した分だけずらす)。
  - 実装: FR1.2、FR1.3、FR1.5
- [x] **Step 10: 一覧の処理のテストを書いて実行する**
  - `entries` の置き換えと追加、`entry` が先頭に足される、同じ `id` は 2 度入らない、リセット(空の置き換え)で空になる、時刻の書式、スクロールの位置の維持(先頭のときは動かさない)。
- [x] **Step 11: 画面(`index.html`、`styles.css`、`main.ts`)を実装する**
  - `index.html`: `#room` の中に、ワードクラウドの下へ一覧(`#entries`、`<ul>`)を足す。`data-testid` を付ける。
  - `styles.css`: 上半分(ワードクラウド)と下半分(一覧)を 1 対 1 に分け、一覧は縦にスクロールできる。1 行は時刻と文。
  - `main.ts`: `entries`、`entry` を受け取り、`entries.ts` で統合して描画する。文は `textContent` で入れる。先頭より下を読んでいるときは、足した分だけスクロールをずらす。ルームを開き直したら、一覧を空にして、`sync` の応答で作り直す。
  - 実装: FR1.1、FR1.2、FR1.3、FR1.4、FR1.5、FR1.6、FR1.8
- [x] **Step 12: 画面のテストについて**
  - 画面のコード(`main.ts`、描画)には、既存のテストがない(ブラウザなしでは実行できない)。この Step では、Step 10 の純粋な関数のテストで、一覧の動作を確かめる。画面そのものの確認は、Build and Test と、デプロイ後の人による確認で行う(Node 上のテストは、実際のブラウザでの確認ではない)。
- [x] **Step 13: 参加者への周知と、ガイド**
  - `packages/web/src/join.html`: 入力欄の近くに、「入力した内容は、会場の画面に表示され、保存されて、24 時間で消えます」の短い文を足す(スタイルは `join.css`)。
  - `docs/organizer-guide.html`(73 行目の「名前などの個人情報は保存しません」の周辺)と `docs/participant-guide.html`(47 行目の周辺)を、新しい扱いに合わせて直す。一覧欄の使い方も、主催者向けのガイドに一言足す。
  - `README.md` は変更しない。
  - 実装: FR3.1、FR3.2
- [x] **Step 14: AWS 側の確認(コードは変更しない)**
  - `infra/lib/wordcloud-stack.ts` は変更しない。`WsHandler` は `PutItem` と `Query`、`HttpHandler` は `Query` と `BatchWriteItem` の権限を、既に持つことを確認する。
  - 実装: NFR5、NFR6(テーブルは置き換えない)
- [x] **Step 15: 文書とトレーサビリティ**
  - `code-summary.md` と `traceability.json` を書く。作った経緯と、保存の方針の変更を `code-summary.md` に書く。

## 要件との対応

| 要件 | 対応する Step |
|---|---|
| FR1.1、FR1.2、FR1.3、FR1.4、FR1.6、FR1.8 | 9、11 |
| FR1.5 | 9、10、11 |
| FR1.7 | 3、5、6 |
| FR2.1、FR2.2 | 3、4、5 |
| FR2.3、FR2.4 | 2、5、6 |
| FR2.5 | 5、6 |
| FR2.6 | 2、5、6、7 |
| FR3.1、FR3.2 | 13 |
| NFR1 | 3、7 |
| NFR2、NFR3 | 5、9(測定は Build and Test) |
| NFR4 | 全 Step のテストと型検査 |
| NFR5、NFR6 | 14 |

## 計画しないこと

- AWS 上のリソースの変更。件数の上限。不適切な入力の非表示。送信した人の名前の表示。Chrome 拡張機能の変更。
- デプロイの実行(後のステージで行う)。

## 注意

- **入力された文が、24 時間、DynamoDB に保存される。** 表示用の画面は、ルームコードを知っていれば誰でも接続できる(今の仕組みのまま)ので、ルームコードを知っている人は、全員の入力文を読める。会場に表示される内容と同じである。
- デプロイの前に、変更をコミットする必要がある(デプロイスクリプトは、未コミットの変更があると止まる)。

## Sources

- `aidlc/spaces/default/intents/261123-input-list-panel/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/codekb/mkwordcloud/`(architecture.md、api-documentation.md、code-structure.md)
- `packages/core/src/protocol.ts`、`packages/server/src/service.ts`、`repository.ts`、`dynamo-repository.ts`、`packages/web/src/main.ts`、`index.html`、`styles.css`

## 前提

- 1 件は約 300 バイト以内である(100 文字、日本語は 1 文字 3 バイトとして)ので、50 件で 1 つのメッセージは約 17 キロバイトに収まり、API Gateway の 128 キロバイトの上限を超えない。
- DynamoDB の項目の大きさ、ルームごとの書き込みの量は、既存の制限(1 クライアントあたり 1 分に 20 回)の範囲に収まる。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "各テスト可能な層を実装してから、その層のテストを書いて実行する。",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 各テスト可能な層を実装してから、その層のテストを書いて実行する。\n- **Methodology evidence**: インタビュー Q3 で test-after を選んだ。履歴は 3 コミットのみで、テストが実装に先行した痕跡はない。各 package と infra に vitest のテストがあり、TDD/BDD を示す feature ファイルやシナリオ仕様は見つからない。\n- カバレッジ: 行カバレッジ 80% 以上を必須とし、CI で確認する(インタビュー Q4)。この基準を満たすために基準を下げない。\n- テスト実行: `npm test`(vitest run、タイムアウト 60 秒)。型検査は `npm run typecheck`。\n- infra には CDK のアサーションテスト(`infra/test/stack.test.ts`)があり、リソース数・アラーム・ダッシュボードを検証している。"
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
  "input_sha256": "sha256:01c48c6cf504e638d449ab927703b33b574adcb9421ce6b09f19da7423ee7368",
  "contract_sha256": "sha256:fe332c590f30b2d5f53c9fcd9a0acf246dbe5141e1a4867c5cacfd0753edf219"
}
```
