import {
  ERROR_MESSAGES,
  TOP_WORDS,
  checkRate,
  generateHostKey,
  generateRoomCode,
  hashHostKey,
  isValidRoomCode,
  normalizeRoomCode,
  validateText,
  verifyHostKey,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
  type Tokenize,
} from '@wordcloud/core';
import type { Repository, Role } from './repository.js';

/** 接続への送信。切断済みなら false を返す。 */
export interface Pusher {
  push(connId: string, message: ServerMessage): Promise<boolean>;
}

export interface Deps {
  repo: Repository;
  pusher: Pusher;
  tokenize: Tokenize;
  /** 現在時刻(epochミリ秒)。テストでは固定値を渡す。 */
  now: () => number;
  /** 許可するOrigin(例: https://xxxx.cloudfront.net, chrome-extension://<id>) */
  allowedOrigins: string[];
  /** ローカル開発用: 任意の chrome-extension:// を許可する。 */
  allowAnyExtension?: boolean;
}

export const MAX_BODY_BYTES = 2048;
const MAX_WS_MESSAGE_BYTES = 1024;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// ---------------------------------------------------------------- Origin

/** Origin が許可されているか。Origin ヘッダーが無い場合(curl 等)は許可する。 */
export function isOriginAllowed(origin: string | undefined, deps: Pick<Deps, 'allowedOrigins' | 'allowAnyExtension'>): boolean {
  if (origin === undefined || origin === '') return true;
  if (deps.allowedOrigins.includes(origin)) return true;
  if (deps.allowAnyExtension && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return true;
  return false;
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------- REST

export interface RestRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: string | null;
}

export interface RestResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function lowerHeaders(h: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h ?? {})) if (typeof v === 'string') out[k.toLowerCase()] = v;
  return out;
}

function json(status: number, data: unknown, cors: Record<string, string>): RestResponse {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors },
    body: JSON.stringify(data),
  };
}

export async function handleRest(req: RestRequest, deps: Deps): Promise<RestResponse> {
  const headers = lowerHeaders(req.headers);
  const origin = headers['origin'];
  const method = req.method.toUpperCase();

  if (!isOriginAllowed(origin, deps)) {
    return json(403, { error: 'origin_not_allowed' }, {});
  }
  const cors: Record<string, string> = origin
    ? { 'access-control-allow-origin': origin, vary: 'Origin' }
    : {};

  if (method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        ...cors,
        'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,x-host-key',
        'access-control-max-age': '600',
      },
      body: '',
    };
  }

  if (req.body && Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
    return json(413, { error: 'body_too_large' }, cors);
  }
  if (req.body && req.body.trim().length > 0) {
    try {
      JSON.parse(req.body);
    } catch {
      return json(400, { error: 'invalid_json' }, cors);
    }
  }

  const path = req.path.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 1 && parts[0] === 'rooms' && method === 'POST') {
    return createRoom(deps, cors);
  }
  if (parts[0] === 'rooms' && parts.length >= 2) {
    const code = normalizeRoomCode(decodeURIComponentSafe(parts[1]));
    if (parts.length === 2 && method === 'GET') {
      if (!isValidRoomCode(code) || !(await deps.repo.getRoom(code))) {
        return json(404, { error: 'room_not_found' }, cors);
      }
      return json(200, { exists: true }, cors);
    }
    if (parts.length === 3 && parts[2] === 'reset' && method === 'POST') {
      return hostAction('reset', code, headers['x-host-key'], deps, cors);
    }
    if (parts.length === 2 && method === 'DELETE') {
      return hostAction('end', code, headers['x-host-key'], deps, cors);
    }
  }
  return json(404, { error: 'not_found' }, cors);
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
}

async function createRoom(deps: Deps, cors: Record<string, string>): Promise<RestResponse> {
  const hostKey = generateHostKey();
  const hostKeyHash = hashHostKey(hostKey);
  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();
    const meta = await deps.repo.createRoom(code, hostKeyHash);
    if (meta) {
      return json(201, { roomCode: code, hostKey, expiresAt: new Date(meta.ttl * 1000).toISOString() }, cors);
    }
  }
  return json(503, { error: 'room_code_unavailable' }, cors);
}

async function hostAction(
  action: 'reset' | 'end',
  code: string,
  hostKey: string | undefined,
  deps: Deps,
  cors: Record<string, string>,
): Promise<RestResponse> {
  const room = isValidRoomCode(code) ? await deps.repo.getRoom(code) : null;
  if (!room) return json(404, { error: 'room_not_found' }, cors);
  if (!verifyHostKey(hostKey, room.hostKeyHash)) return json(403, { error: 'forbidden' }, cors);

  const viewers = await deps.repo.listViewers(code);
  if (action === 'reset') {
    await deps.repo.resetWords(code);
    await broadcast(deps, viewers, { type: 'snapshot', words: [] });
  } else {
    await deps.repo.deleteRoom(code);
    await broadcast(deps, viewers, { type: 'ended' });
  }
  return json(200, { ok: true }, cors);
}

/** 接続の一覧へ送る。切断済みの接続は登録から外す。 */
async function broadcast(deps: Deps, connIds: string[], message: ServerMessage): Promise<void> {
  await Promise.all(
    connIds.map(async (id) => {
      let ok = false;
      try {
        ok = await deps.pusher.push(id, message);
      } catch {
        ok = true; // 一時的な失敗では登録を消さない
      }
      if (!ok) await deps.repo.removeConnection(id).catch(() => undefined);
    }),
  );
}

// ---------------------------------------------------------------- WebSocket

export interface WsConnectInput {
  connId: string;
  query: { room?: string; role?: string; clientId?: string };
  headers: Record<string, string | undefined>;
}

export type WsConnectResult = { ok: true } | { ok: false; status: 400 | 403 | 404; reason: string };

export async function handleWsConnect(input: WsConnectInput, deps: Deps): Promise<WsConnectResult> {
  const headers = lowerHeaders(input.headers);
  if (!isOriginAllowed(headers['origin'], deps)) {
    return { ok: false, status: 403, reason: 'origin_not_allowed' };
  }
  const role = input.query.role;
  if (role !== 'participant' && role !== 'viewer') {
    return { ok: false, status: 400, reason: 'invalid_role' };
  }
  const code = normalizeRoomCode(input.query.room ?? '');
  const room = isValidRoomCode(code) ? await deps.repo.getRoom(code) : null;
  if (!room) return { ok: false, status: 404, reason: 'room_not_found' };

  let clientId = input.query.clientId ?? '';
  if (role === 'participant') {
    if (!CLIENT_ID_RE.test(clientId)) return { ok: false, status: 400, reason: 'invalid_client_id' };
  } else {
    clientId = 'viewer';
  }
  await deps.repo.addConnection({ connId: input.connId, room: code, role: role as Role, clientId }, room.ttl);
  return { ok: true };
}

export async function handleWsDisconnect(input: { connId: string }, deps: Deps): Promise<void> {
  await deps.repo.removeConnection(input.connId);
}

async function sendError(deps: Deps, connId: string, code: ErrorCode): Promise<void> {
  await deps.pusher.push(connId, { type: 'error', code, message: ERROR_MESSAGES[code] });
}

function parseClientMessage(body: string): ClientMessage | null {
  if (Buffer.byteLength(body, 'utf8') > MAX_WS_MESSAGE_BYTES) return null;
  try {
    const v = JSON.parse(body) as unknown;
    if (!v || typeof v !== 'object') return null;
    const t = (v as { type?: unknown }).type;
    if (t === 'ping') return { type: 'ping' };
    if (t === 'sync') return { type: 'sync' };
    if (t === 'submit') return { type: 'submit', text: (v as { text?: unknown }).text as string };
    return null;
  } catch {
    return null;
  }
}

/** 受信メッセージを処理する。入力テキストそのものは保存もログ出力もしない(FR3.7、NFR3.3)。 */
export async function handleWsMessage(input: { connId: string; body: string }, deps: Deps): Promise<void> {
  const msg = parseClientMessage(input.body ?? '');
  if (!msg) return sendError(deps, input.connId, 'invalid_json');
  if (msg.type === 'ping') {
    await deps.pusher.push(input.connId, { type: 'pong' });
    return;
  }

  const conn = await deps.repo.getConnection(input.connId);
  if (!conn) return sendError(deps, input.connId, 'forbidden');
  const room = await deps.repo.getRoom(conn.room);
  if (!room) return sendError(deps, input.connId, 'no_room');

  if (msg.type === 'sync') {
    if (conn.role !== 'viewer') return sendError(deps, input.connId, 'forbidden');
    const words = (await deps.repo.getWords(conn.room)).slice(0, TOP_WORDS);
    await deps.pusher.push(input.connId, { type: 'snapshot', words });
    return;
  }

  // submit: 参加者のみ
  if (conn.role !== 'participant') return sendError(deps, input.connId, 'forbidden');
  const v = validateText(msg.text);
  if (!v.ok) return sendError(deps, input.connId, v.code);

  // レート制限は、clientId 単位(再接続しても有効)と接続単位(clientId を変えても有効)の両方を満たす必要がある(NFR2.5)。
  // 接続単位の状態は、既存の RATE アイテムの別キー(`conn:<connId>`)に保存する。clientId の形式に ':' は含まれないため衝突しない。
  const now = deps.now();
  const connKey = `conn:${input.connId}`;
  const byClient = checkRate(await deps.repo.getRate(conn.room, conn.clientId), now);
  if (!byClient.allowed) return sendError(deps, input.connId, byClient.reason ?? 'too_fast');
  const byConn = checkRate(await deps.repo.getRate(conn.room, connKey), now);
  if (!byConn.allowed) return sendError(deps, input.connId, byConn.reason ?? 'too_fast');
  await deps.repo.putRate(conn.room, conn.clientId, byClient.state);
  await deps.repo.putRate(conn.room, connKey, byConn.state);

  const words = await deps.tokenize(v.text);
  if (words.length > 0) {
    const updated = await deps.repo.incrementWords(conn.room, words, room.ttl);
    const viewers = await deps.repo.listViewers(conn.room);
    await broadcast(deps, viewers, { type: 'update', words: updated });
  }
  await deps.pusher.push(input.connId, { type: 'ack' });
}
