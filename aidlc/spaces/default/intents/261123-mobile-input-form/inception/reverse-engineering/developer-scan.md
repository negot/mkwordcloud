## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - packages/core/src/ (protocol.ts, constants.ts, room.ts, sanitize.ts)
  - packages/extension/src/ (popup.ts, popup.html, protocol.ts) と packages/extension/manifest.json
  - packages/server/src/ (service.ts, local.ts, lambda/http.ts)
  - packages/web/src/ (logic.ts, index.html, main.ts の冒頭)
  - infra/lib/wordcloud-stack.ts
  - scripts/build-web.mjs, scripts/build-extension.mjs
  - package.json, packages/core/package.json, packages/server/package.json, feature-mobile-form.md
- **Skimmed only**:
  - packages/core/src/ (rate.ts, tokenizer.ts, stopwords.ts, index.ts)
  - packages/server/src/ (dynamo-repository.ts, memory-repository.ts, repository.ts, apigw-pusher.ts, lambda/ws.ts)
  - packages/web/src/ (api.ts, cloud.ts, socket.ts, styles.css)
  - 各 packages/*/test/ と infra/test/, infra/bin/, infra/lib/config.ts
  - scripts/apply-outputs.mjs, scripts/load-test.mjs
  - docs/ (organizer-guide.html, participant-guide.html), README.md
- **Left out**: node_modules/, dist/, cdk.out/, cdk-outputs.json, package-lock.json, .git/, .DS_Store, および AI-DLC 自身の導入物(.kiro/, aidlc/, AGENTS.md)

### Packages Found
- @wordcloud/core — library — TypeScript — 共有プロトコル型、定数、ルームコード/ホストキー、サニタイズ、レート制限、kuromoji 語分割
- @wordcloud/server — service + Lambda + local dev server — TypeScript — REST/WebSocket ロジック(service.ts)、DynamoDB/メモリ リポジトリ
- @wordcloud/web — browser app — TypeScript — 主催者の表示画面(ワードクラウド描画、viewer 役)
- @wordcloud/extension — Chrome MV3 extension — TypeScript — 参加者の送信ポップアップ(participant 役)
- infra — CDK app — TypeScript — S3 + CloudFront、API Gateway(HTTP/WebSocket)、Lambda、DynamoDB、CloudWatch

### Build System
- **Type**: npm workspaces + esbuild(ブラウザ向け)+ tsc(typecheck のみ)+ AWS CDK(deploy)
- **Config Files**: package.json, tsconfig.json, tsconfig.base.json, vitest.config.ts, cdk.json
- **Build Dependencies**: server/web/extension → core。web は scripts/build-web.mjs で main.js / index.html / styles.css のみを dist へ出力(エントリは main.ts 1つ)。extension は scripts/build-extension.mjs で popup.js と config.json を生成。CDK は packages/web/dist を S3 へ配置し config.json(apiUrl, wsUrl)を追加

### APIs Discovered
- HTTP API(REST, API Gateway v2 + http Lambda) — packages/server/src/service.ts handleRest — 4 operations: POST /rooms, GET /rooms/{code}, POST /rooms/{code}/reset, DELETE /rooms/{code}
- WebSocket API(API Gateway v2 + ws Lambda) — service.ts handleWsConnect / handleWsMessage — 接続クエリ `?room=<CODE>&role=participant|viewer&clientId=<id>`、クライアント→サーバー: submit / ping / sync、サーバー→クライアント: snapshot / update / ack / pong / ended / error
- ローカル開発サーバー — packages/server/src/local.ts — 同じ handleRest/handleWs* を http+ws で提供し、packages/web/dist を静的配信、/config.json を動的に返す

### Frameworks & Libraries
- AWS CDK (aws-cdk-lib) — ^2.150 (CLI) — インフラ定義
- kuromoji — ^0.1.2 — 日本語の語分割(ws Lambda のみ)
- ws — ^8.18.0 — ローカルサーバーの WebSocket
- @aws-sdk/client-dynamodb, lib-dynamodb, client-apigatewaymanagementapi — ^3.600 — 永続化と接続への push
- esbuild ^0.23, typescript ^5.5, vitest ^2, tsx ^4.16, adm-zip ^0.5 — ビルド/テスト(devDependencies)
- UI フレームワークなし(素の DOM + TypeScript)

### Test Coverage
- **Test Directories**: packages/core/test, packages/server/test, packages/web/test, packages/extension/test, infra/test
- **Test Frameworks**: vitest
- **Coverage Config**: absent(vitest.config.ts にカバレッジ設定の確認なし。深くは読んでいない)

### Code Quality Indicators
- **Linting**: 検出できず(ESLint/Prettier 設定ファイルは追跡対象に無い)。型検査は `npm run typecheck`
- **CI/CD**: パイプラインファイル無し(`npm run deploy` による手動 cdk deploy)
- **Documentation**: README.md と docs/*.html(主催者/参加者ガイド)あり。コードコメントは日本語で、要件ID(FR/NFR)を参照している

### Technical Debt Signals
- packages/extension/src/protocol.ts と packages/web/src/logic.ts に、parseConfig、backoffDelay、normalizeRoomCode(core にも同名あり)が重複している。core の room.ts は node:crypto を使うため、ブラウザ側は core の index ではなく `@wordcloud/core/protocol` と `/constants` のサブパスだけを import している(core/package.json の exports)
- CORS の許可は ALLOWED_ORIGINS(CloudFront オリジン + chrome-extension://<id>)に限定される(wordcloud-stack.ts)。許可リストに無い Origin は REST が 403、WS connect が 403 になる。Origin ヘッダーが無い場合は許可
- CloudFront の CSP が `script-src 'self'`(インラインスクリプト不可)、`connect-src 'self' https://*.execute-api.<region>.amazonaws.com wss://...`、`frame-ancestors 'none'`(wordcloud-stack.ts)
- TODO/FIXME/@ts-ignore の確認は、shell のグロブ失敗で網羅的には実施していない(未確認)

## Handoff Summary
- **Intent-relevant finding**: 拡張機能の送信経路は (1) `GET {apiUrl}/rooms/{code}` で存在確認(200 / 404)、(2) `wss://.../?room=<CODE>&role=participant&clientId=<8〜64字 [A-Za-z0-9_-]>` で WebSocket 接続、(3) `{"type":"submit","text":"..."}` を送信、(4) `ack` または `error{code,message}` / `ended` を受信、という流れ(packages/extension/src/popup.ts、protocol.ts)。サーバー契約は packages/server/src/service.ts にあり、拡張機能専用の分岐は無く、Origin が許可リストに入っていれば Web ページからも同じ経路を使える。ルームコードは 8 文字、アルファベット `ABCDEFGHJKMNPQRSTUVWXYZ23456789`、`NFKC` 正規化+空白除去+大文字化(core/room.ts)。テキストは 100 コードポイントまで、レートは 1 秒間隔かつ 1 分 20 回(clientId 単位と接続単位の両方)(core/constants.ts、service.ts)。静的配信は S3 + CloudFront(OAC、HTTPS 強制)で、`config.json`(apiUrl, wsUrl)を同じ配信元に置く。web の esbuild ビルドは main.ts 1 エントリのみ(scripts/build-web.mjs)で、別ページを追加するにはビルドスクリプトの変更が必要。ローカル開発は local.ts が packages/web/dist を配信する。
- **Risks / follow-up**: (a) モバイルフォームは CloudFront と同一オリジンから配信すれば既存の ALLOWED_ORIGINS(webOrigin)と CSP に収まり、サーバー変更は不要になる見込み。別オリジンから配信する場合は ALLOWED_ORIGINS の追加が必要。(b) 拡張機能の popup.ts は chrome.storage に依存するため、モバイル側は localStorage に置き換える必要がある(clientId の保持、最終ルーム)。(c) インラインスクリプト不可(CSP)のため、モバイルフォームも外部 JS ファイルとして出力する。(d) core のルートを import するとブラウザバンドルに node:crypto が入る恐れがあるので、`@wordcloud/core/protocol`・`/constants` のサブパスを使う(normalizeRoomCode は core/room.ts にあるが拡張機能は自前実装を持つ)。(e) 既存の web index.html は `#/room/<CODE>` のハッシュルーティングを viewer 用に使っている(logic.ts parseRoomFromLocation)。モバイルフォームを同じ SPA に統合するか別ページにするかは設計判断。(f) CloudFront の defaultRootObject は index.html のみ。別ページ(例: /join.html)は S3 にファイルがあれば取得できる。(g) 参加者側の WebSocket 接続は同時接続数・スロットリングの影響を受ける(HTTP スロットル 20 req/s、WS 100 req/s)。モバイルの参加者増加時の負荷は構成上の考慮点。
