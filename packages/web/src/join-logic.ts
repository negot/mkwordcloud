// スマートフォン向け入力フォームの純粋ロジック(ブラウザなしでテストできる)。
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@wordcloud/core/constants';
import {
  LAST_ROOM_KEY,
  normalizeRoomCode,
  type KeyValueStore,
} from '../../extension/src/protocol.js';

// 拡張機能と同じ通信契約のヘルパーを再利用する(複製しない)。FR2.2〜FR2.6、FR3.3、NFR5
export {
  LAST_ROOM_KEY,
  backoffDelay,
  buildSubmit,
  buildWsUrl,
  describeServerMessage,
  getOrCreateClientId,
  normalizeRoomCode,
  parseConfig,
  parseServerMessage,
  remainingChars,
  MAX_TEXT_LENGTH,
  type ExtConfig,
  type KeyValueStore,
} from '../../extension/src/protocol.js';

/** ルームコードが正しい形式か(長さと使用文字)。 */
function isValidCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** `?room=CODE` からルームコードを取り出して正規化する。不正なら空文字。FR1.2、FR1.4 */
export function roomFromSearch(search: string): string {
  const raw = new URLSearchParams(search).get('room');
  if (raw === null) return '';
  const code = normalizeRoomCode(raw);
  return isValidCode(code) ? code : '';
}

/** 正規化済みコードの検証。問題なければ null、あれば日本語メッセージ。FR1.2、FR1.3 */
export function validateRoomCode(code: string): string | null {
  if (code.length === 0) return 'ルームコードを入力してください。';
  if (!isValidCode(code)) return `ルームコードは${ROOM_CODE_LENGTH}文字です。もう一度確認してください。`;
  return null;
}

/** localStorage 互換の最小インターフェース。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * localStorage を KeyValueStore にする。保存できない環境(プライベートモード等)では
 * メモリ上の値に切り替えて動作を続ける。FR3.1、FR3.2
 */
export function createLocalStore(storage: StorageLike | undefined): KeyValueStore {
  const memory = new Map<string, string>();
  return {
    async get(key) {
      try {
        const v = storage?.getItem(key);
        if (typeof v === 'string') return v;
      } catch {
        // 読み出せない場合はメモリ上の値を使う
      }
      return memory.get(key);
    },
    async set(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(key, value);
      } catch {
        // 保存できなくてもメモリ上の値で続ける
      }
    },
  };
}
