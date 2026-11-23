import { describe, expect, it } from 'vitest';
import type { Entry } from '@wordcloud/core/protocol';
import { adjustScroll, applyEntries, countAddedAbove, formatTime } from '../src/entries.js';

const e = (id: string, at = 1): Entry => ({ id, text: `t-${id}`, at });

describe('applyEntries (FR1.3, FR1.5, FR1.7)', () => {
  it('replace:true で一覧を置き換え、続きは末尾に足される', () => {
    let list = applyEntries([e('old')], { type: 'entries', items: [e('c'), e('b')], replace: true });
    expect(list.map((x) => x.id)).toEqual(['c', 'b']);
    list = applyEntries(list, { type: 'entries', items: [e('a')], replace: false });
    expect(list.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('entry は先頭に足され、同じ id は 2 度入らない', () => {
    let list = applyEntries([e('a')], { type: 'entry', item: e('b') });
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
    list = applyEntries(list, { type: 'entry', item: e('b') });
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
    list = applyEntries(list, { type: 'entries', items: [e('a'), e('z')], replace: false });
    expect(list.map((x) => x.id)).toEqual(['b', 'a', 'z']);
  });

  it('空の置き換え(リセット)で一覧が空になる', () => {
    expect(applyEntries([e('a')], { type: 'entries', items: [], replace: true })).toEqual([]);
  });

  it('置き換えの応答より先に届いた、新しい項目は失わない', () => {
    const list = applyEntries([e('fresh', 300)], { type: 'entries', items: [e('b', 200), e('a', 100)], replace: true });
    expect(list.map((x) => x.id)).toEqual(['fresh', 'b', 'a']);
  });
});

describe('formatTime (FR1.2)', () => {
  it('時:分:秒を 2 桁で返す', () => {
    const d = new Date(2024, 0, 2, 3, 4, 5).getTime();
    expect(formatTime(d)).toBe('03:04:05');
  });
});

describe('スクロール位置の維持 (FR1.5)', () => {
  it('先頭より下を読んでいるときだけ、足した分だけずらす', () => {
    expect(adjustScroll(200, 1000, 1060)).toBe(260);
    expect(adjustScroll(0, 1000, 1060)).toBe(0);
  });

  it('以前の先頭より上に足された件数を数える。作り直しは 0', () => {
    const next = [e('n2'), e('n1'), e('a')];
    expect(countAddedAbove('a', next)).toBe(2);
    expect(countAddedAbove('gone', next)).toBe(0);
    expect(countAddedAbove(undefined, next)).toBe(0);
  });
});
