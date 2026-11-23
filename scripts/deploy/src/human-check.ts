// 人による確認(FR5.3、FR5.4、FR5.5、NFR1.5)。項目を 1 つずつ尋ね、結果を記録用に返す。
// URL は画面に表示するだけで、ブラウザは開かない。
import type { Io } from './prompter.js';

export type HumanAnswer = 'confirmed' | 'unchecked' | 'problem';

export const HUMAN_CHECK_ITEMS = ['画面表示', 'WebSocket の接続', '送信から表示までの動作'] as const;

export interface HumanCheckItem {
  name: string;
  result: HumanAnswer;
}

export interface HumanCheckResult {
  items: HumanCheckItem[];
  /** 「問題があった」が 1 つでもあれば true(終了コードは非ゼロ)。 */
  hasProblem: boolean;
}

/** 1(確認した)、2(確認しなかった)、3(問題があった)。それ以外と無回答は「確認しなかった」。 */
export function parseHumanAnswer(raw: string | null): HumanAnswer {
  const s = (raw ?? '').trim();
  if (s === '1' || s === '確認した') return 'confirmed';
  if (s === '3' || s === '問題があった') return 'problem';
  return 'unchecked';
}

export async function runHumanCheck(io: Io, webUrl: string | undefined): Promise<HumanCheckResult> {
  io.print('--- 人による確認(自動では確認できない項目) ---');
  io.print(`表示用 Web の URL(ブラウザは自動では開きません): ${webUrl ?? '(出力から取得できません)'}`);
  io.print('回答: 1 = 確認した / 2 = 確認しなかった / 3 = 問題があった');
  const items: HumanCheckItem[] = [];
  for (const name of HUMAN_CHECK_ITEMS) {
    const raw = await io.ask(`${name}: `);
    items.push({ name, result: parseHumanAnswer(raw) });
  }
  return { items, hasProblem: items.some((i) => i.result === 'problem') };
}
