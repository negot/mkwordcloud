import { MAX_TEXT_LENGTH } from './constants.js';

export type ValidateResult =
  | { ok: true; text: string }
  | { ok: false; code: 'empty' | 'too_long' };

/**
 * 入力テキストを正規化する。
 * NFKC正規化、制御文字の除去(改行・タブは空白に)、HTML特殊文字の除去、連続空白の圧縮、前後の空白除去。
 */
export function sanitize(text: string): string {
  let s = String(text).normalize('NFKC');
  s = s.replace(/[\n\r\t\u2028\u2029]/g, ' ');
  // 制御文字(Cc)と書式文字(Cf)を除去
  s = s.replace(/[\p{Cc}\p{Cf}]/gu, '');
  // HTMLの特殊文字は区切り文字として扱い、語に残さない
  s = s.replace(/[<>&"'`]/g, ' ');
  s = s.replace(/\s+/gu, ' ').trim();
  return s;
}

/** コードポイント数を数える。 */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

/**
 * 送信テキストを検証する。100文字ちょうどは受理、101文字は拒否(NFR2.4)。
 * 文字数は正規化・除去の前の入力で数える(超過分は拒否するため)。
 */
export function validateText(text: unknown): ValidateResult {
  if (typeof text !== 'string') return { ok: false, code: 'empty' };
  if (codePointLength(text) > MAX_TEXT_LENGTH) return { ok: false, code: 'too_long' };
  const cleaned = sanitize(text);
  if (cleaned.length === 0) return { ok: false, code: 'empty' };
  return { ok: true, text: cleaned };
}
