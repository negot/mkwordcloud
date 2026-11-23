# コード生成の要約: 入力データの一覧欄

## 作ったもの

表示用の画面の下半分に、入力された文を新しい順に並べる一覧欄を足した。文は DynamoDB(既存のテーブル、`ENTRY#<時刻13桁>#<id>`)に 24 時間保存し、表示用の接続へ `entries`(50 件ずつ、最初が `replace: true`)と `entry`(新しい 1 件)で届ける。リセットは語と文の両方を消し、空の `snapshot` と空の `entries`(`replace: true`)を送る。画面は `textContent` で描画し、先頭より下を読んでいるときは足した分だけスクロールをずらす。AWS 側(`infra/`)は変更していない。

## 変更したパス

新規:
- `packages/web/src/entries.ts`(一覧の純粋な関数: `applyEntries`、`formatTime`、`countAddedAbove`、`adjustScroll`)
- `packages/web/test/entries.test.ts`

変更:
- `packages/core/src/protocol.ts`(`Entry`、`entries`、`entry`)
- `packages/core/src/constants.ts`(`ENTRY_CHUNK_SIZE = 50`)
- `packages/server/src/repository.ts`(`addEntry`、`listEntries`、`resetEntries`、`entrySk`、`sortEntriesNewestFirst`)
- `packages/server/src/memory-repository.ts`
- `packages/server/src/dynamo-repository.ts`
- `packages/server/src/service.ts`(`submit` で保存と `entry` の配信、`sync` で `entries`、リセットで文も削除。`node:crypto` の `randomUUID` で id を作る)
- `packages/server/test/repository.test.ts`、`service.test.ts`、`api.test.ts`
- `packages/web/src/index.html`、`styles.css`、`main.ts`
- `packages/web/src/join.html`、`join.css`(保存の周知の文)
- `docs/organizer-guide.html`、`docs/participant-guide.html`

削除: なし。確認のみ(変更なし): `lambda/ws.ts`、`lambda/http.ts`、`local.ts`(ログには例外名だけを出し、入力文は出さない。`local.ts` は `ServerMessage` をそのまま JSON で送るので新しいメッセージも通る)、`infra/lib/wordcloud-stack.ts`(`WsHandler` は PutItem と Query、`HttpHandler` は Query と DeleteItem を持つ。既存のリセットが使う BatchWrite の削除はこの権限で動く)。

## 動かし方

- テスト(このまとまり): `npx vitest run packages/server/test/repository.test.ts packages/server/test/service.test.ts packages/server/test/api.test.ts packages/web/test/entries.test.ts`
- 全体: `npm run typecheck`、`npm test`、`npm run build:web`
- ローカルで見る: 既存の `local.ts` のローカルサーバー(入力文はメモリに保存)。

## テスト結果(実測)

- このまとまりのコマンド: 4 ファイル、56 件、すべて通過(repository 18、service 23、api 9、entries 6)。
- `npm run typecheck`: エラーなし。
- `npm test`: 20 ファイル、245 件、すべて通過。既存の 224 件と合わせ、追加は 21 件(repository +5、service +7、api +3、entries +6)。
- `npm run build:web`: 成功(`main.js` 16.4kb、`join.js` 6.8kb)。
- 実ブラウザでの確認と AWS 上の確認は行っていない(計画どおり、後のステージとデプロイ後の人による確認で行う)。

## 計画からのずれ

- 既存の service テスト 1 件(リセット後に最後のメッセージが空の `snapshot`)を、リセットで `entries` が最後に届く新しい仕様に合わせて直した。もう 1 件は題名だけ直した(語の集計に入力文が入らない、という内容は同じ)。
- `entries.ts` に、計画にない `countAddedAbove`(以前の先頭より上に足された件数)を足した。再接続や作り直しのときに、スクロールを誤ってずらさないため。
- `join.css` に `.note.retention`(左寄せ)を足した。
- 追加した依存はない。

## 未実施・既知の点

- 画面そのもの(`main.ts` の描画、スクロール位置の維持)は、ブラウザなしのテストがなく、純粋な関数だけをテストした。
- `sync` の応答(`replace: true`)より先に届いた新しい `entry` は、応答で消えるおそれがあった。これは、`entries.ts` の `applyEntries` を直して(置き換えの応答より新しい項目は残す)、テストを 1 件足して解消した。(変更後: `npm test` 245 件に 1 件足した 246 件、entries のテストは 7 件)
- `traceability.json` は、`aidlc engine sensor-traceability` がこの役割では拒否されたため、既存と同じ形で手で書いた。
- デプロイは実行していない。デプロイの前に変更のコミットが必要(デプロイスクリプトの仕様)。

## 保存の方針の変更

これまで: 入力された文は保存もログ出力もせず、語と回数だけを持っていた。
これから: 入力された文(整形済み)を、ルームと同じ TTL(24 時間、`ROOM_TTL_SECONDS`)で DynamoDB に保存する。読み取り時にも `ttl` を確認し、期限切れは返さない。リセットとルームの終了で、保存した文も消える。ログには出さない(NFR1)。`join.html` と 2 本のガイドに、「入力した内容は、会場の画面に表示され、保存されて、24 時間で消えます」の趣旨を書いた。ルームコードを知っている人は、表示用として接続すれば全員の入力文を読める(会場の画面と同じ内容)。
