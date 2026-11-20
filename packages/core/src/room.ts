import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants.js';

/** 推測されにくいルームコードを生成する。FR1.2 */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** ルームコードの形式を検査する(大文字化済みの値を想定)。 */
export function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** ユーザー入力のルームコードを正規化する(空白除去・大文字化)。 */
export function normalizeRoomCode(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, '').toUpperCase();
}

/** 主催者キーを生成する(24バイトのランダム値を base64url で表現)。NFR2.7 */
export function generateHostKey(): string {
  return randomBytes(24).toString('base64url');
}

/** 主催者キーのハッシュ(sha256 の16進文字列)。サーバーにはこの値のみ保存する。 */
export function hashHostKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** 主催者キーがハッシュと一致するかを、定数時間で比較する。 */
export function verifyHostKey(key: unknown, hash: string): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return false;
  const a = Buffer.from(hashHostKey(key), 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
