import { describe, expect, it } from 'vitest';
import { drawPlaced, type CloudWord } from '../src/cloud.js';
import {
  backoffDelay,
  buildViewerWsUrl,
  fontSize,
  mergeWords,
  parseConfig,
  parseRoomFromLocation,
  topWords,
} from '../src/logic.js';

describe('語の統合・上位N語・サイズ (FR4.2, FR4.3, FR4.5)', () => {
  it('更新は絶対値で上書きされ、count降順になる', () => {
    const merged = mergeWords(
      [
        { word: '猫', count: 1 },
        { word: 'dog', count: 2 },
      ],
      [
        { word: '猫', count: 3 },
        { word: 'bird', count: 1 },
      ],
    );
    expect(merged).toEqual([
      { word: '猫', count: 3 },
      { word: 'dog', count: 2 },
      { word: 'bird', count: 1 },
    ]);
  });

  it('不正な更新(0以下・非数)は無視する', () => {
    expect(mergeWords([], [{ word: 'a1', count: 0 }, { word: 'b1', count: NaN }])).toEqual([]);
  });

  it('上位N語に絞る(初期値100)', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ word: `w${i}`, count: i + 1 }));
    const top = topWords(many);
    expect(top).toHaveLength(100);
    expect(top[0]).toEqual({ word: 'w149', count: 150 });
    expect(topWords(many, 3)).toHaveLength(3);
  });

  it('出現回数が多い語ほどフォントが大きい(最小〜最大の範囲)', () => {
    const small = fontSize(1, 1, 100);
    const mid = fontSize(25, 1, 100);
    const big = fontSize(100, 1, 100);
    expect(small).toBe(20);
    expect(big).toBe(140);
    expect(mid).toBeGreaterThan(small);
    expect(mid).toBeLessThan(big);
    expect(fontSize(5, 5, 5)).toBeGreaterThan(20);
  });
});

describe('設定とURLの解析 (FR4.1, FR4.6)', () => {
  it('config.json を検証し、末尾のスラッシュを除く', () => {
    expect(parseConfig({ apiUrl: 'https://a.example/', wsUrl: 'wss://b.example/prod' })).toEqual({
      apiUrl: 'https://a.example',
      wsUrl: 'wss://b.example/prod',
    });
    expect(() => parseConfig({ apiUrl: 'ftp://x', wsUrl: 'wss://x' })).toThrow();
    expect(() => parseConfig(null)).toThrow();
  });

  it('URLのハッシュからルームコードを取り出す', () => {
    expect(parseRoomFromLocation('#/room/abcd2345')).toBe('ABCD2345');
    expect(parseRoomFromLocation('#/other')).toBeNull();
    expect(parseRoomFromLocation('#/room/<script>')).toBeNull();
  });

  it('表示側のWebSocket URLを組み立て、再接続の待ち時間は上限がある', () => {
    expect(buildViewerWsUrl('wss://x/prod', 'ABCD2345')).toBe('wss://x/prod?room=ABCD2345&role=viewer');
    expect(backoffDelay(0, () => 0.5)).toBe(1000);
    expect(backoffDelay(10, () => 0.5)).toBe(15000);
  });
});

/** textContent と属性だけを記録する最小のDOM(innerHTML は用意しない)。 */
class FakeNode {
  attrs: Record<string, string> = {};
  children: FakeNode[] = [];
  textContent = '';
  constructor(public tag: string) {}
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  appendChild(c: FakeNode) {
    this.children.push(c);
  }
  replaceChildren(...c: FakeNode[]) {
    this.children = c;
  }
}

describe('XSS対策 (NFR2.3)', () => {
  it('HTMLを含む語は textContent の文字列として描かれ、要素は増えない', () => {
    const doc = { createElementNS: (_ns: string, tag: string) => new FakeNode(tag) } as unknown as Document;
    const svg = new FakeNode('svg');
    const evil = '<img src=x onerror=alert(1)>';
    const placed: CloudWord[] = [{ text: evil, size: 30, count: 1, x: 1, y: 2 }];
    drawPlaced(doc, svg as unknown as SVGSVGElement, placed, 800, 600);
    const g = svg.children[0];
    expect(g.children).toHaveLength(1);
    expect(g.children[0].tag).toBe('text');
    expect(g.children[0].textContent).toBe(evil);
    expect(g.children[0].children).toHaveLength(0);
  });
});
