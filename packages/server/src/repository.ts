import type { RateState, WordCount } from '@wordcloud/core';

export type { WordCount };

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
