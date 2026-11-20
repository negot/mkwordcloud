import { ROOM_TTL_SECONDS, type RateState } from '@wordcloud/core';
import {
  RATE_TTL_SECONDS,
  sortWords,
  type ConnectionInfo,
  type Repository,
  type RoomMeta,
  type WordCount,
} from './repository.js';

interface Timed<T> {
  value: T;
  ttl: number;
}

/** インメモリ実装(テストとローカル開発用)。TTL を過ぎた項目は無視する。 */
export class MemoryRepository implements Repository {
  private rooms = new Map<string, Timed<RoomMeta>>();
  private words = new Map<string, Map<string, Timed<number>>>();
  private conns = new Map<string, Timed<ConnectionInfo>>();
  private viewers = new Map<string, Map<string, number>>(); // room -> connId -> ttl
  private rates = new Map<string, Timed<RateState>>();

  constructor(private readonly clock: () => number = Date.now) {}

  private alive(ttl: number): boolean {
    return ttl * 1000 > this.clock();
  }

  async createRoom(code: string, hostKeyHash: string): Promise<RoomMeta | null> {
    if (await this.getRoom(code)) return null;
    const createdAt = this.clock();
    const meta: RoomMeta = {
      code,
      hostKeyHash,
      createdAt,
      ttl: Math.floor(createdAt / 1000) + ROOM_TTL_SECONDS,
    };
    this.rooms.set(code, { value: meta, ttl: meta.ttl });
    return meta;
  }

  async getRoom(code: string): Promise<RoomMeta | null> {
    const r = this.rooms.get(code);
    return r && this.alive(r.ttl) ? r.value : null;
  }

  async deleteRoom(code: string): Promise<void> {
    this.rooms.delete(code);
    this.words.delete(code);
    this.viewers.delete(code);
  }

  async resetWords(code: string): Promise<void> {
    this.words.delete(code);
  }

  async incrementWords(code: string, words: string[], ttl: number): Promise<WordCount[]> {
    let m = this.words.get(code);
    if (!m) {
      m = new Map();
      this.words.set(code, m);
    }
    const out: WordCount[] = [];
    for (const w of words) {
      const cur = m.get(w);
      const count = (cur && this.alive(cur.ttl) ? cur.value : 0) + 1;
      m.set(w, { value: count, ttl });
      out.push({ word: w, count });
    }
    return out;
  }

  async getWords(code: string): Promise<WordCount[]> {
    const m = this.words.get(code);
    if (!m) return [];
    const out: WordCount[] = [];
    for (const [word, t] of m) if (this.alive(t.ttl)) out.push({ word, count: t.value });
    return sortWords(out);
  }

  async addConnection(conn: ConnectionInfo, ttl: number): Promise<void> {
    this.conns.set(conn.connId, { value: conn, ttl });
    if (conn.role === 'viewer') {
      let v = this.viewers.get(conn.room);
      if (!v) {
        v = new Map();
        this.viewers.set(conn.room, v);
      }
      v.set(conn.connId, ttl);
    }
  }

  async getConnection(connId: string): Promise<ConnectionInfo | null> {
    const c = this.conns.get(connId);
    return c && this.alive(c.ttl) ? c.value : null;
  }

  async removeConnection(connId: string): Promise<void> {
    const c = this.conns.get(connId);
    this.conns.delete(connId);
    if (c) this.viewers.get(c.value.room)?.delete(connId);
  }

  async listViewers(room: string): Promise<string[]> {
    const v = this.viewers.get(room);
    if (!v) return [];
    return [...v].filter(([, ttl]) => this.alive(ttl)).map(([id]) => id);
  }

  async getRate(room: string, clientId: string): Promise<RateState | undefined> {
    const r = this.rates.get(`${room}#${clientId}`);
    return r && this.alive(r.ttl) ? r.value : undefined;
  }

  async putRate(room: string, clientId: string, state: RateState): Promise<void> {
    this.rates.set(`${room}#${clientId}`, {
      value: state,
      ttl: Math.floor(this.clock() / 1000) + RATE_TTL_SECONDS,
    });
  }
}
