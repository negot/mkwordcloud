import type { Entry, ServerMessage } from '@wordcloud/core/protocol';

/**
 * 一覧欄の純粋な処理(ブラウザなしでテストできる)。
 * 一覧は新しい順(先頭が最新)で保つ。
 */

type EntryMessage = Extract<ServerMessage, { type: 'entries' | 'entry' }>;

/** id が重複する項目を除く(先に現れた方を残す)。FR1.5 */
function uniqueById(items: Entry[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const e of items) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/**
 * entries / entry のメッセージを一覧へ統合する。元の配列は変えない。
 * - entries(replace: true): 一覧を作り直す(空の items でリセット。FR1.7)
 * - entries(replace: false): 古い方への続きとして末尾へ足す
 * - entry: 先頭に足す(FR1.3)
 */
export function applyEntries(current: readonly Entry[], message: EntryMessage): Entry[] {
  if (message.type === 'entry') return uniqueById([message.item, ...current]);
  if (message.replace) {
    // 空の置き換えはリセット(FR1.7)。空でないときは、応答より先に届いた新しい項目を失わない。
    if (message.items.length === 0) return [];
    const newest = message.items[0].at;
    const newer = current.filter((e) => e.at > newest);
    return uniqueById([...newer, ...message.items]);
  }
  return uniqueById([...current, ...message.items]);
}

/** 時:分:秒(ブラウザの時刻帯)。FR1.2 */
export function formatTime(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 以前の先頭の項目より上に、新しく足された項目が何件あるか。
 * 以前の先頭が一覧に無い(作り直し)ときと、以前が空のときは 0。
 */
export function countAddedAbove(prevFirstId: string | undefined, next: readonly Entry[]): number {
  if (prevFirstId === undefined) return 0;
  const i = next.findIndex((e) => e.id === prevFirstId);
  return i < 0 ? 0 : i;
}

/**
 * 先頭に足した分だけスクロール位置をずらす。FR1.5
 * 先頭にいる(oldTop が 0 以下)ときは動かさず、新しい項目が先頭に現れる。
 */
export function adjustScroll(oldTop: number, oldHeight: number, newHeight: number): number {
  if (oldTop <= 0) return oldTop;
  return oldTop + Math.max(0, newHeight - oldHeight);
}
