import { TOP_WORDS } from '@wordcloud/core/constants';
import type { WordCount } from '@wordcloud/core/protocol';

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
}

/** 更新(語と絶対値の回数)を現在の集計へ統合し、count降順で返す。FR4.3 */
export function mergeWords(current: WordCount[], updates: WordCount[]): WordCount[] {
  const map = new Map<string, number>();
  for (const w of current) map.set(w.word, w.count);
  for (const u of updates) {
    if (typeof u.word === 'string' && Number.isFinite(u.count) && u.count > 0) map.set(u.word, u.count);
  }
  return sortDesc([...map].map(([word, count]) => ({ word, count })));
}

function sortDesc(words: WordCount[]): WordCount[] {
  return words.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
}

/** 上位N語に絞る。FR4.5 */
export function topWords(words: WordCount[], n: number = TOP_WORDS): WordCount[] {
  return sortDesc([...words]).slice(0, Math.max(0, n));
}

/** 出現回数からフォントサイズ(px)を求める。sqrtスケール。FR4.2 */
export function fontSize(count: number, minCount: number, maxCount: number, minPx = 20, maxPx = 140): number {
  if (maxCount <= minCount) return Math.round(minPx + (maxPx - minPx) * 0.6);
  const t = (Math.sqrt(count) - Math.sqrt(minCount)) / (Math.sqrt(maxCount) - Math.sqrt(minCount));
  return Math.round(minPx + (maxPx - minPx) * Math.min(1, Math.max(0, t)));
}

/** /config.json の内容を検証して設定にする。 */
export function parseConfig(data: unknown): AppConfig {
  const d = data as { apiUrl?: unknown; wsUrl?: unknown } | null;
  if (!d || typeof d.apiUrl !== 'string' || typeof d.wsUrl !== 'string') {
    throw new Error('設定ファイルの形式が正しくありません');
  }
  if (!/^https?:\/\//.test(d.apiUrl)) throw new Error('apiUrl は http(s):// で始まる必要があります');
  if (!/^wss?:\/\//.test(d.wsUrl)) throw new Error('wsUrl は ws(s):// で始まる必要があります');
  return { apiUrl: d.apiUrl.replace(/\/+$/, ''), wsUrl: d.wsUrl.replace(/\/+$/, '') };
}

/** URLのハッシュ(#/room/<CODE>)からルームコードを取り出す。 */
export function parseRoomFromLocation(hash: string): string | null {
  const m = /^#\/room\/([A-Za-z0-9]{4,16})\/?$/.exec(hash);
  return m ? m[1].toUpperCase() : null;
}

/** 表示側の WebSocket URL を組み立てる。 */
export function buildViewerWsUrl(wsUrl: string, room: string): string {
  return `${wsUrl}?room=${encodeURIComponent(room)}&role=viewer`;
}

/** 自動再接続の待ち時間(ミリ秒)。指数バックオフ(上限15秒)。 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(15000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.8 + random() * 0.4));
}

export const HOST_KEY_PREFIX = 'wordcloud.hostKey.';
