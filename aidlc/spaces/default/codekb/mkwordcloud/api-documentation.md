# API Documentation

実装: packages/server/src/service.ts。型: packages/core/src/protocol.ts。

## HTTP API(JSON、Origin 検査あり)
| Method / Path | 認可 | 応答 |
|---------------|------|------|
| POST /rooms | なし | 201 `{roomCode, hostKey, expiresAt}`、503 |
| GET /rooms/{code} | なし | 200 `{exists:true}`、404 `room_not_found` |
| POST /rooms/{code}/reset | ヘッダー `x-host-key` | 200 `{ok:true}`、403、404 |
| DELETE /rooms/{code} | ヘッダー `x-host-key` | 200、403、404 |
| OPTIONS | - | 204(CORS) |

- 本文上限 2048 バイト(413)、不正 JSON は 400。コードは `normalizeRoomCode` で正規化後に検査する。
- 許可外 Origin は 403。Origin ヘッダーが無い場合は許可される。
- スロットル: rate 20 / burst 40(infra)。

## WebSocket API
- 接続: `{wsUrl}?room=<CODE>&role=participant|viewer&clientId=<ID>`。participant は clientId 必須(`^[A-Za-z0-9_-]{8,64}$`)。拒否: 400 `invalid_role` / `invalid_client_id`、403 `origin_not_allowed`、404 `room_not_found`。
- クライアント→サーバー(1024 バイト以内): `{"type":"submit","text":string}`(participant のみ)、`{"type":"sync"}`(viewer のみ)、`{"type":"ping"}`。
- サーバー→クライアント: `ack`、`pong`、`ended`、`snapshot{words}`、`update{words}`、`error{code,message}`。
- error code: invalid_json, empty, too_long, too_fast, too_many, no_room, forbidden(日本語文言は `ERROR_MESSAGES`)。
- 制約値(core/constants.ts): 本文 100 コードポイント、最短間隔 1000ms、1 分 20 回、ルームコード 8 文字(`ABCDEFGHJKMNPQRSTUVWXYZ23456789`)、TTL 86400 秒。
- スロットル: rate 100 / burst 200(infra)。

## クライアント設定
`/config.json` に `{apiUrl, wsUrl}`。CloudFront 配信では CDK が配置し、ローカルでは local.ts が動的に返す。
