/** 1回の送信の最大文字数(コードポイント数)。NFR2.4 */
export const MAX_TEXT_LENGTH = 100;
/** 同一クライアントの最短送信間隔(ミリ秒)。NFR2.5 */
export const RATE_MIN_INTERVAL_MS = 1000;
/** レート制限の窓(ミリ秒)。NFR2.5 */
export const RATE_WINDOW_MS = 60000;
/** 窓内の最大送信回数。NFR2.5 */
export const RATE_MAX_PER_WINDOW = 20;
/** ルームの保持時間(秒)。FR1.5 */
export const ROOM_TTL_SECONDS = 86400;
/** 表示する上位語数。FR4.5 */
export const TOP_WORDS = 100;
/** 1語の最大長。 */
export const MAX_WORD_LENGTH = 30;
/** ルームコードの長さ。FR1.2 */
export const ROOM_CODE_LENGTH = 8;
/** ルームコードに使う文字(紛らわしい文字 I, L, O, 0, 1 を除く)。 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
