import { MAX_TEXT_LENGTH } from '@wordcloud/core/constants';
import { errorMessage, type ServerMessage } from '@wordcloud/core/protocol';

export { errorMessage, MAX_TEXT_LENGTH };

export interface ExtConfig {
  apiUrl: string;
  wsUrl: string;
}

/** chrome.storage.local を差し替え可能にした最小の入れ物。 */
export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export const CLIENT_ID_KEY = 'clientId';
export const LAST_ROOM_KEY = 'lastRoom';

/** 匿名のランダムな clientId を作り、保存して再利用する。個人を特定する情報は含まない。FR2.6、NFR3.1 */
export async function getOrCreateClientId(
  store: KeyValueStore,
  randomUUID: () => string = () => crypto.randomUUID(),
): Promise<string> {
  const existing = await store.get(CLIENT_ID_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
  const id = randomUUID();
  await store.set(CLIENT_ID_KEY, id);
  return id;
}

/** 入力されたルームコードを正規化する(空白除去・大文字化)。 */
export function normalizeRoomCode(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, '').toUpperCase();
}

/** 参加者の WebSocket URL を組み立てる。 */
export function buildWsUrl(wsUrl: string, room: string, clientId: string): string {
  return `${wsUrl.replace(/\/+$/, '')}?room=${encodeURIComponent(room)}&role=participant&clientId=${encodeURIComponent(clientId)}`;
}

/** 送信メッセージ(JSON文字列)を組み立てる。 */
export function buildSubmit(text: string): string {
  return JSON.stringify({ type: 'submit', text });
}

/** 受信メッセージを解釈する。不正なら null。 */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const v = JSON.parse(data) as { type?: unknown; code?: unknown; message?: unknown };
    if (v.type === 'ack' || v.type === 'pong' || v.type === 'ended') return { type: v.type };
    if (v.type === 'error' && typeof v.code === 'string') {
      return {
        type: 'error',
        code: v.code as never,
        message: typeof v.message === 'string' ? v.message : errorMessage(v.code),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** 画面に出す文言。サーバーのコードから日本語メッセージを選ぶ。FR2.4 */
export function describeServerMessage(m: ServerMessage): string | null {
  if (m.type === 'error') return errorMessage(m.code);
  if (m.type === 'ended') return 'ルームは終了しました。';
  return null;
}

/** 残り文字数(コードポイント数で数える)。 */
export function remainingChars(text: string): number {
  return MAX_TEXT_LENGTH - Array.from(text).length;
}

/** 再接続の待ち時間(ミリ秒)。指数バックオフ(上限15秒)。 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(15000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.8 + random() * 0.4));
}

export function parseConfig(data: unknown): ExtConfig {
  const d = data as { apiUrl?: unknown; wsUrl?: unknown } | null;
  if (!d || typeof d.apiUrl !== 'string' || typeof d.wsUrl !== 'string') {
    throw new Error('設定ファイル(config.json)の形式が正しくありません');
  }
  return { apiUrl: d.apiUrl.replace(/\/+$/, ''), wsUrl: d.wsUrl.replace(/\/+$/, '') };
}
