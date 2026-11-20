import cloud from 'd3-cloud';
import type { WordCount } from '@wordcloud/core/protocol';
import { fontSize, topWords } from './logic.js';

const FONT_FAMILY = '"Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
const PALETTE = ['#ffd166', '#06d6a0', '#4cc9f0', '#f78c6b', '#c77dff', '#ef476f', '#e9ff70', '#ffffff'];
const SVG_NS = 'http://www.w3.org/2000/svg';
/** 再描画の最短間隔(ミリ秒)。 */
export const RENDER_INTERVAL_MS = 1500;

export interface CloudWord extends cloud.Word {
  text: string;
  size: number;
  count: number;
}

function colorFor(word: string): string {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** 配置済みの語をSVGに描く。語の文字列は textContent でのみ設定する(NFR2.3)。 */
export function drawPlaced(doc: Document, svg: SVGSVGElement, placed: CloudWord[], width: number, height: number): void {
  const g = doc.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${width / 2},${height / 2})`);
  for (const p of placed) {
    const t = doc.createElementNS(SVG_NS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('transform', `translate(${p.x ?? 0},${p.y ?? 0})`);
    t.setAttribute('font-size', String(p.size));
    t.setAttribute('font-weight', '700');
    t.setAttribute('font-family', FONT_FAMILY);
    t.setAttribute('fill', colorFor(p.text));
    t.setAttribute('data-testid', 'cloud-word');
    t.textContent = p.text;
    g.appendChild(t);
  }
  svg.replaceChildren(g);
}

/** 語を d3-cloud で配置し、SVG に描く。語の文字列は textContent でのみ設定する(NFR2.3)。 */
export function renderCloud(svg: SVGSVGElement, words: WordCount[], width: number, height: number): void {
  const top = topWords(words);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (top.length === 0) {
    svg.replaceChildren();
    return;
  }
  const counts = top.map((w) => w.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const input: CloudWord[] = top.map((w) => ({
    text: w.word,
    count: w.count,
    size: fontSize(w.count, min, max),
  }));

  cloud<CloudWord>()
    .size([width, height])
    .words(input)
    .padding(6)
    .rotate(() => 0)
    .font(FONT_FAMILY)
    .fontSize((d) => d.size)
    .spiral('rectangular')
    .on('end', (placed) => drawPlaced(document, svg, placed as CloudWord[], width, height))
    .start();
}
