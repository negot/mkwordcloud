# テスト手順: 入力データの一覧欄

## テストの枠組み

- フレームワーク: vitest(既存、`vitest.config.ts`)。タイムアウトは 60 秒。
- 方針: test-after(各層を実装してから、その層のテストを書いて実行する)。Minimal の強度で、要件ごとに 1 件を基本とする約 15 件の追加と、既存の 224 件が通り続けること。

## 実行コマンド(このまとまりだけ)

このまとまりが触るテストファイルだけを実行する。

```
npx vitest run packages/server/test/repository.test.ts packages/server/test/service.test.ts packages/server/test/api.test.ts packages/web/test/entries.test.ts
```

型検査(全体):

```
npm run typecheck
```

既存のテスト全体(`npm test`)が通り続けることは、Build and Test が全体のスイートで確認する。

## カバレッジ

- Minimal の強度の express スコープは、追加の行カバレッジの下限を設けない。team.md の「行カバレッジ 80% 以上」は、デプロイスクリプト(`scripts/deploy/`)に設定したしきい値(`vitest.config.ts`)で守られている。今回の追加のコード(`packages/*`)には、しきい値を足さない。
- 追加した関数と経路ごとに、少なくとも 1 件のテストを置く。

## 追加するテスト(要件ごと)

| 要件 | テスト | ファイル |
|---|---|---|
| FR2.1、FR2.2 | 文が保存され、新しい順に返る。期限を過ぎた文は返さない | `repository.test.ts`(メモリ版と DynamoDB のモック) |
| FR1.7 | `resetEntries` が文だけを消し、語は残す。`deleteRoom` が文も消す | `repository.test.ts` |
| FR2.4、FR2.5 | 送信で `entry` が表示用の接続だけに届く。参加者には `ack` だけ | `service.test.ts` |
| FR2.1 | 語に分けた結果が空の文も、保存して送る | `service.test.ts` |
| FR2.3 | `sync` で、`snapshot` に続けて保存済みの文が新しい順に届く。50 件を超えると分かれて届き、最初のまとまりだけが `replace: true` | `service.test.ts` |
| FR1.7 | リセットで、語と文の両方が空になり、`snapshot`(空)と `entries`(空、`replace: true`)が届く | `service.test.ts`、`api.test.ts` |
| FR2.6 | 既存の `update`、`ack` の内容が変わらない | `service.test.ts` |
| NFR1 | 送信された文が、ログ出力にも、`ack` にも、`update` にも含まれない(`entry` と保存先だけに入る) | `service.test.ts` |
| FR1.2、FR1.3 | `entries` の置き換えと追加、`entry` が先頭に足される。時刻の書式 | `entries.test.ts` |
| FR1.5 | 同じ `id` は 2 度入らない。先頭より下を読んでいるときだけ、スクロールの位置をずらす | `entries.test.ts` |
| FR1.7 | 空の置き換え(リセット)で一覧が空になる | `entries.test.ts` |

## モックとスタブ

- DynamoDB は、既存のテストと同じ仕組み(`packages/server/test/helpers.ts`、`aws-sdk-client-mock`)で差し替える。
- 時刻は、`Deps.now` に固定値を渡す。
- 表示用の接続への送信(`Pusher`)は、既存のテストのモックを使い、送られたメッセージを集める。
- 画面(`main.ts`)は、ブラウザなしでは実行できないため、テストしない。一覧の動作は、純粋な関数(`entries.ts`)のテストで確かめる。

## テストデータ

- 入力文は、固定の短い日本語と英語の例(例: 「猫が好きです」、「hello」)を使う。個人情報は使わない。
- 51 件以上を作るテストは、ループで作る。

## 実行しないもの

- 実際の AWS、実際のブラウザ。これらは、Build and Test の後の、デプロイと人による確認で行う。

## Sources

- `code-generation-plan.md`
- `aidlc/spaces/default/memory/team.md`(Testing Posture)
- `aidlc/spaces/default/intents/261123-input-list-panel/inception/requirements-analysis/requirements.md`

## Assumptions & Open Questions

- Assumptions: 既存の `repository.test.ts` が、DynamoDB のモックを使えるようになっている。(実装のときに確認する)
- Open questions: None.
