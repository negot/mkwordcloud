import type { Entry, RateState, WordCount } from '@wordcloud/core';

export type { Entry, WordCount };

export type Role = 'participant' | 'viewer';

/** ルームのメタ情報。主催者キーはハッシュのみ保持する(NFR2.7)。 */
export interface RoomMeta {
  code: string;
  hostKeyHash: string;
  /** 作成時刻(epochミリ秒) */
  createdAt: number;
  /** 削除予定時刻(epoch秒、DynamoDB TTL) */
  ttl: number;
}

/** 接続情報。clientId は拡張機能が作る匿名のランダム値で、個人を特定しない(NFR3.1)。 */
export interface ConnectionInfo {
  connId: string;
  room: string;
  role: Role;
  clientId: string;
}

/** データアクセス層。全アイテムに ttl(epoch秒)を付ける。 */
export interface Repository {
  /** ルームを作成する。同じコードが既にあれば null。 */
  createRoom(code: string, hostKeyHash: string): Promise<RoomMeta | null>;
  getRoom(code: string): Promise<RoomMeta | null>;
  /** ROOM#code 配下の全アイテムを削除する。 */
  deleteRoom(code: string): Promise<void>;
  /** 全語の集計を消す(ルームと表示側の登録は残す)。 */
  resetWords(code: string): Promise<void>;
  /** 語の出現回数を1ずつ加算し、更新後の {word,count} を返す。 */
  incrementWords(code: string, words: string[], ttl: number): Promise<WordCount[]>;
  /** 全語を count 降順で返す。 */
  getWords(code: string): Promise<WordCount[]>;
  /** 入力文を 1 件保存する。ttl はルームと同じ(epoch秒)。FR2.1、FR2.2 */
  addEntry(code: string, entry: Entry, ttl: number): Promise<void>;
  /** 保存済みの入力文を新しい順に返す。期限切れは返さない。FR2.3、NFR1 */
  listEntries(code: string): Promise<Entry[]>;
  /** 入力文だけを全て消す(語の集計とルームは残す)。FR1.7 */
  resetEntries(code: string): Promise<void>;
  addConnection(conn: ConnectionInfo, ttl: number): Promise<void>;
  getConnection(connId: string): Promise<ConnectionInfo | null>;
  removeConnection(connId: string): Promise<void>;
  /** 表示ページ(viewer)の接続IDの一覧。 */
  listViewers(room: string): Promise<string[]>;
  getRate(room: string, clientId: string): Promise<RateState | undefined>;
  putRate(room: string, clientId: string, state: RateState): Promise<void>;
}

/** count降順(同数は語の辞書順)に整列する。 */
export function sortWords(words: WordCount[]): WordCount[] {
  return [...words].sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
}

/** レート制限の記録の保持秒数(窓の2倍)。 */
export const RATE_TTL_SECONDS = 120;

/** 入力文の sk の接頭辞。時刻は 13 桁のゼロ埋めで、辞書順が時刻順になる。 */
export const ENTRY_SK_PREFIX = 'ENTRY#';

export function entrySk(entry: Entry): string {
  return `${ENTRY_SK_PREFIX}${String(Math.max(0, Math.floor(entry.at))).padStart(13, '0')}#${entry.id}`;
}

/** 新しい順(at 降順、同時刻は id 降順)に整列する。 */
export function sortEntriesNewestFirst(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
