/**
 * クライアントとサーバーが共有するメッセージの型と文言。
 * ブラウザ向けのバンドルにも入るため、Node 専用の import を含めない。
 */

export interface WordCount {
  word: string;
  count: number;
}

/** 一覧欄に並べる入力文 1 件。id は表示側の重複除去に使う。FR1.2、FR1.5、FR2.1 */
export interface Entry {
  id: string;
  /** 受け付けのときに整形済みの入力文。 */
  text: string;
  /** サーバーが受け取った時刻(ミリ秒)。 */
  at: number;
}

export type ErrorCode =
  | 'invalid_json'
  | 'empty'
  | 'too_long'
  | 'too_fast'
  | 'too_many'
  | 'no_room'
  | 'forbidden';

export type ServerMessage =
  | { type: 'snapshot'; words: WordCount[] }
  | { type: 'update'; words: WordCount[] }
  /** 保存済みの文のまとまり(新しい順)。replace が真なら一覧を作り直す。FR2.3 */
  | { type: 'entries'; items: Entry[]; replace: boolean }
  /** 新しい 1 件。FR2.4 */
  | { type: 'entry'; item: Entry }
  | { type: 'ack' }
  | { type: 'pong' }
  | { type: 'ended' }
  | { type: 'error'; code: ErrorCode; message: string };

export type ClientMessage =
  | { type: 'submit'; text: string }
  | { type: 'ping' }
  | { type: 'sync' };

/** エラーコードごとの日本語メッセージ。 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_json: 'メッセージの形式が正しくありません。',
  empty: '送信する文字を入力してください。',
  too_long: '100文字以内で入力してください。',
  too_fast: '送信が早すぎます。1秒以上あけてください。',
  too_many: '送信回数の上限(1分に20回)に達しました。少し待ってください。',
  no_room: 'ルームが終了したか、存在しません。',
  forbidden: 'この操作は許可されていません。',
};

export function errorMessage(code: string): string {
  return (ERROR_MESSAGES as Record<string, string>)[code] ?? '送信できませんでした。しばらくしてからもう一度お試しください。';
}
