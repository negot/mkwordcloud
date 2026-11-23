## Developer Code Scan Results

Run: 2026-11-23 / commit 680f4417ad3b60356396dd59e45a7532516a72ef / focused scan of a STALE store / Minimal depth / brownfield。
Intent: 261123-input-list-panel(表示 Web アプリに「入力リスト」パネルを足す: 上半分ワードクラウド、下半分に送信されたキーワードと文の一覧)。

### Scan Coverage
- **Analyzed deeply**:
  - packages/web/(src の全ファイルと test。dist/ は除く)
  - packages/server/(src の全ファイルと test)
  - packages/core/(src の全ファイルと test)
  - infra/(lib/wordcloud-stack.ts のデータ経路、test は grep でログ・保持の検査のみ確認)
  - scripts/build-web.mjs
- **Skimmed only**:
  - scripts/deploy/(src 16 ファイルと test は名前と冒頭コメント、grep のみ)
  - scripts/apply-outputs.mjs、scripts/build-extension.mjs、scripts/load-test.mjs(load-test は submit の送り方だけ grep)
  - docs/deploy.md(全文を読んだが手順書として要約のみ)、docs/organizer-guide.html、docs/participant-guide.html(未読)
  - packages/extension/(protocol.ts の公開関数だけ。web/join が再利用するため)
  - package.json、vitest.config.ts、infra/test/stack.test.ts(grep)
- **Left out**: node_modules/、dist/、packages/web/dist/、cdk.out/、cdk.out.deploy/、deploy-logs/、cdk-outputs.json、docs/presentation.html と feature-mobile-form.md(.gitignore 対象)、.git/、.kiro/、aidlc/(AI-DLC の導入物)

### Packages Found
- @wordcloud/core: library(TS)。共有型・定数・サニタイズ・レート判定・語分割・ルームコード
- @wordcloud/server: service + Lambda ハンドラー(TS)。REST/WS ロジック、DynamoDB/メモリ リポジトリ、ローカルサーバー
- @wordcloud/web: 表示画面(viewer)と参加用モバイルフォーム(join)。素の DOM + d3-cloud
- extension(範囲外・skim): Chrome MV3 参加者ポップアップ。join が protocol.ts を再利用
- infra: CDK v2 スタック `WordcloudStack`

### Build System
- **Type**: npm workspaces + esbuild(web)+ tsc(型検査のみ)+ vitest + CDK(NodejsFunction が Lambda を esbuild でバンドル)
- **Config Files**: package.json、vitest.config.ts、tsconfig.json、tsconfig.base.json、cdk.json、scripts/build-web.mjs
- **Build Dependencies**: web は core の subpath(`@wordcloud/core/protocol`、`/constants`)と `../../extension/src/protocol.js`(join-logic.ts)に依存。server は core。infra は web/dist と server/src/lambda/*.ts を取り込む。build-web.mjs は main.ts と join.ts を別々に bundle し、index.html、styles.css、join.html、join.css を dist へコピーする。

### APIs Discovered
- HTTP API(service.ts handleRest): POST /rooms、GET /rooms/{code}、POST /rooms/{code}/reset、DELETE /rooms/{code}、OPTIONS。本文上限 2048B、Origin 検査。
- WebSocket(service.ts handleWsConnect / handleWsMessage): `$connect?room=&role=participant|viewer&clientId=`、`$disconnect`、`$default`。
- WS メッセージ(core/protocol.ts)
  - Client→Server: `{type:'submit', text}`(participant のみ)、`{type:'sync'}`(viewer のみ)、`{type:'ping'}`。1 メッセージ 1024B まで。
  - Server→Client: `snapshot{words}`、`update{words}`、`ack`、`pong`、`ended`、`error{code,message}`。
  - **`update` の中身**: `words: {word, count}[]`。その 1 回の submit で語分割された語だけが入り、count は DB 加算後の絶対値(service.ts:`incrementWords` の戻り値をそのまま broadcast)。元の入力文・送信者・時刻・連番は含まない。`snapshot` は sync への応答(上位 100 語、`TOP_WORDS`)とリセット時の空配列で、全語ではない。
  - **`ack`** は `{type:'ack'}` のみで、本文を返さない。語が 0 個(全てストップワード等)でも ack は返る(update は出ない)。
  - **`error`**: code は invalid_json / empty / too_long / too_fast / too_many / no_room / forbidden(日本語文言は `ERROR_MESSAGES`)。
- viewer の受信処理(main.ts onMessage): `snapshot` は置換、`update` は mergeWords で絶対値上書き、`ended` と `error:no_room` は終了表示。他は無視。

### Frameworks & Libraries
- d3-cloud ^1.2.7(web、SVG へ配置描画)、kuromoji ^0.1.2(core、日本語の語分割)
- @aws-sdk/client-dynamodb / lib-dynamodb / client-apigatewaymanagementapi ^3.600.0(server)、ws ^8.18.0(ローカル)
- aws-cdk-lib(infra)、esbuild ^0.23、vitest ^2、typescript ^5.5(版は package.json の宣言値)

### Test Coverage
- **Test Directories**: packages/{core,server,web,extension}/test、infra/test、scripts/deploy/test
- **Test Frameworks**: vitest(`testTimeout` 60000)、aws-sdk-client-mock(Dynamo)
- **Coverage Config**: 有り。ただし vitest.config.ts の coverage は `scripts/deploy/src/**` だけを対象に行 80% の閾値。他 package にカバレッジ閾値は無い。
- web の test は logic.test.ts(mergeWords、topWords、fontSize など)と join-logic.test.ts のみ。cloud.ts、main.ts、socket.ts、api.ts にテストは無い(DOM 描画は未検証)。

### Code Quality Indicators
- **Linting**: 無し(型検査 `npm run typecheck` のみ。team.md の方針と一致)
- **CI/CD**: 無し。`npm run deploy`(scripts/deploy)による承認つき手動デプロイ
- **Documentation**: README.md、docs/deploy.md、docs/*.html。コードは日本語コメントで FR/NFR ID を参照

### Technical Debt Signals
- parseConfig / backoffDelay / normalizeRoomCode が web(logic.ts)、extension(protocol.ts)、core(room.ts)に重複。join-logic.ts は extension の実装を再利用するため web→extension の相対 import ができている。
- viewer 側の描画(main.ts、cloud.ts)に自動テストが無い。
- `update` が語だけなので、元テキストの履歴は、サーバーにもクライアントにも存在しない(下記)。

## Handoff Summary
- **Intent-relevant finding**:
  1. **viewer に届くのは語の集計だけで、入力文は届かない。** `handleWsMessage`(packages/server/src/service.ts、`submit` 分岐)は `validateText`(core/sanitize.ts)で得た `v.text` を `deps.tokenize(v.text)` に渡し、その語だけを `repo.incrementWords` と `update{words}` に使う。元テキストを保持・転送する経路は無い。入力リストパネルには、(a) `update`/`snapshot` に文を載せる、または別メッセージ(例: `entry`)を足す、(b) その文の取得元(再接続時の復元)を決める、が必要。
  2. **入力テキストが捨てられる箇所**: service.ts の `handleWsMessage`(コメント「入力テキストそのものは保存もログ出力もしない(FR3.7、NFR3.3)」)。`msg.text` と `v.text` はこの関数のローカル変数で、tokenize の後は参照されない。Repository インターフェース(repository.ts)にテキストを受ける操作は無い(語・接続・レート・ルームのみ)。Lambda の ws.ts / http.ts は catch で `console.error` にエラー名(と ws は routeKey)だけを出し、本文は出さない(コメントにも明記)。DynamoDB の項目は ROOM#/WORD#、CONN#、VIEWER#、RATE# だけ。
  3. **保証を確かめるテスト**: server/test/service.test.ts「入力テキストそのものは保存されず、語の回数だけが残る」。`getWords` の語集合と `JSON.stringify(words)` に元文が含まれないことだけを検査する。**pusher に送られたメッセージ、ログ出力、Dynamo の全項目は検査していない**。したがって入力文を update に載せても既存テストは落ちず、保証が静かに崩れる。infra/test/stack.test.ts はログ保持 14 日(NFR3.3)を検査する。メッセージ本文の検査は無い。repository.test.ts の FR3.7 / NFR3.2 は語と TTL の保存を見る。
  4. **ログ**: Lambda のロググループ保持は 14 日(wordcloud-stack.ts)。API Gateway のアクセスログ・実行ログの設定は無い(スタック内に該当設定を見つけていない)。
  5. **viewer の状態と描画**: main.ts のモジュール変数 `words: WordCount[]` が唯一の状態。`openRoom` で空にし、`snapshot` で置換、`update` で `mergeWords`(絶対値上書き、count 降順)。描画は `scheduleRender`(1500ms に 1 回、`RENDER_INTERVAL_MS`)が `renderCloud(svg, words, w, h)` を呼ぶ。DOM は index.html の `#room`(`position:fixed; inset:0; display:flex; flex-direction:column`)の中に `header.bar`、`svg#cloud`(`flex:1; min-height:0`)、オーバーレイ `p#room-message`。サイズは `svg.getBoundingClientRect()`(最小 300x200)で決まるため、下半分にパネルを足すなら `#cloud` の高さが変わり、resize 時の再描画が既に `scheduleRender` に繋がっている。文字列は `textContent` でのみ設定(NFR2.3)。web 側の表示・状態には履歴や一覧が無い。
  6. **再接続**: socket.ts は再接続のたびに `sync` を送り `snapshot`(上位 100 語)を受ける。入力文の一覧はサーバーに残らないため、再接続・リロードで一覧は空になる。リセット(`snapshot` 空)時に一覧を消すかどうかも要決定。
  7. **サイズ・頻度の制限**(core/constants.ts、service.ts): 1 回の送信は 100 コードポイント以内(前処理前の長さで判定、超過は `too_long`)、`sanitize` が `<>&"'\`` を空白化し制御文字を除去、NFKC 化。WS メッセージ 1024B、REST 本文 2048B。レートは clientId 単位と接続単位の両方で、最短 1000ms、1 分 20 回(`too_fast`/`too_many`)。API Gateway の WS スロットルは rate 100 / burst 200、HTTP は 20/40。語は 1 メッセージ内で重複除去、1 語 30 文字まで、ストップワード除外。→ 1 件の入力文は最大 100 文字、1 人あたり 1 分 20 件までなので、リスト 1 件の大きさと流入量には上限がある。ルーム全体の件数に上限は無い(リストを持つなら保持件数の上限が要る)。
  8. **fan-out**: `broadcast` は `listViewers` の全接続へ `Promise.all` で push する。入力文を載せると、1 件あたりの push サイズが語リストから文長ぶんだけ増える(100 文字以内)。
- **Risks / follow-up**:
  - 「入力テキストは保存もログ出力もしない」は FR3.7 / NFR3.3 とコード・team.md 側の前提。リスト機能はこれと直接衝突する。(a) 文を viewer へ転送するだけでサーバーに保存しない、(b) 保存する(再接続復元のため)、のどちらにするかは要件の判断で、(b) は要件の変更と DynamoDB のキー設計(ITEM 追加)、ログ・テスト保証の更新を伴う。
  - 文を送る場合、既存テストは保証を守らない(上記 3)。pusher メッセージとログを検査するテストを足す必要がある。
  - サニタイズ後の文(`v.text`)を配信すれば、HTML 特殊文字は除去済みだが、表示は `textContent` のみにする既存の方針を守ること。
  - モバイルフォーム(join.ts)の `#history` は「自分の送信履歴」で、`ack` が本文を返さないため `pending` 配列で対応づけている。viewer 側には同等の仕組みが無い。
  - web の描画・状態コードにテストが無く、パネル追加時の回帰は logic.test.ts の純粋関数テストでしか守れない。パネルの状態管理は logic.ts に純粋関数として切り出すと既存の方針に合う。
  - deploy スクリプトは、未コミットの変更があると止まる。`npm test` と `build:web` を通す(docs/deploy.md)。web を変えたらこの経路で検証される。
  - packages/extension は範囲外。プロトコルを変える場合は extension と join(`parseServerMessage` は ack/pong/ended/error だけを解釈し、`update` と `snapshot` を無視する)への影響を確認する。
