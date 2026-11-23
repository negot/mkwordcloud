# API Documentation

実装: packages/server/src/service.ts。型: packages/core/src/protocol.ts。

## HTTP API(JSON、Origin 検査あり)
| Method / Path | 認可 | 応答 |
|---------------|------|------|
| POST /rooms | なし | 201 `{roomCode, hostKey, expiresAt}`、503 |
| GET /rooms/{code} | なし | 200 `{exists:true}`、404 `room_not_found` |
| POST /rooms/{code}/reset | ヘッダー `x-host-key` | 200 `{ok:true}`、403、404。全 viewer へ空の `snapshot` を push |
| DELETE /rooms/{code} | ヘッダー `x-host-key` | 200、403、404。全 viewer へ `ended` を push |
| OPTIONS | - | 204(CORS) |

- 本文上限 2048 バイト(413)、不正 JSON は 400。コードは `normalizeRoomCode` で正規化後に検査する。
- 許可外 Origin は 403。Origin ヘッダーが無い場合は許可される。
- スロットル: rate 20 / burst 40(infra)。

## WebSocket API
- 接続: `{wsUrl}?room=<CODE>&role=participant|viewer&clientId=<ID>`。participant は clientId 必須(`^[A-Za-z0-9_-]{8,64}$`)。viewer は clientId を使わない。拒否: 400 `invalid_role` / `invalid_client_id`、403 `origin_not_allowed`、404 `room_not_found`。
- 接続の直後は接続へ送信できないため、viewer は接続後に `sync` を送って `snapshot` を受け取る。

### クライアント→サーバー(1024 バイト以内、超過と不正 JSON は `invalid_json`)
| メッセージ | 送れる役割 | 備考 |
|-----------|-----------|------|
| `{"type":"submit","text":string}` | participant のみ(viewer は `forbidden`) | `validateText` → レート制限 → 語分割 → 集計 |
| `{"type":"sync"}` | viewer のみ | `snapshot` を返す |
| `{"type":"ping"}` | 両方 | `pong` を返す |

### サーバー→クライアント(`ServerMessage`)
| メッセージ | 宛先 | 中身 |
|-----------|------|------|
| `{type:'snapshot', words}` | viewer | `sync` への応答は上位 100 語(`TOP_WORDS`)。リセット時は空配列 |
| `{type:'update', words}` | 全 viewer | その submit で出た語だけ。`{word, count}`、count は加算後の絶対値。**入力文は含まない** |
| `{type:'ack'}` | 送信者 | 本文なし。語が 0 個でも返る(その場合 `update` は出ない) |
| `{type:'pong'}` | ping 元 | - |
| `{type:'ended'}` | viewer | DELETE 後 |
| `{type:'error', code, message}` | 送信元 | code は invalid_json / empty / too_long / too_fast / too_many / no_room / forbidden。日本語文言は `ERROR_MESSAGES` |

- クライアント側の解釈: viewer(main.ts)は `snapshot`、`update`、`ended`、`error:no_room` だけを扱う。モバイル入力と拡張機能は extension の `parseServerMessage` を使い、`ack` / `pong` / `ended` / `error` だけを解釈し、`snapshot` と `update` は無視する(null)。
- `ack` は本文を返さないため、モバイル入力は送信順の `pending` 配列で履歴と対応づけている(join.ts)。

### 制約値(core/constants.ts、rate.ts、sanitize.ts)
- 本文 100 コードポイント(前処理前の長さで判定。101 は `too_long`)、空(sanitize 後)は `empty`。
- `sanitize`: NFKC、改行・タブは空白、制御文字と書式文字を除去、`<>&"'\`` は空白、連続空白を圧縮。
- レート: 最短間隔 1000ms(`too_fast`)、1 分の窓で 20 回(`too_many`)。clientId 単位と接続単位(`conn:<connId>`)の両方を満たす必要がある。拒否した場合は状態を進めない。
- 語: 1 語 30 文字まで、1 メッセージ内の重複は 1 回、ストップワード・数字だけ・ひらがな 1 文字は除外。
- ルームコード 8 文字(`ABCDEFGHJKMNPQRSTUVWXYZ23456789`)、TTL 86400 秒。レート記録の TTL 120 秒。
- スロットル: WebSocket rate 100 / burst 200(infra)。

## クライアント設定
`/config.json` に `{apiUrl, wsUrl}`。CloudFront 配信では CDK が配置し、ローカルでは local.ts が動的に返す。
