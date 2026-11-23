// 確認プロンプト(FR3.2、FR3.6、NFR1.1)。あらかじめ決めた回答だけを肯定として扱う。
// それ以外(不正な入力、無回答、入力の終了)は「いいえ」と同じに扱う。
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { RiskReport } from './risk-detector.js';
import { describeRisks } from './risk-detector.js';

export interface Io {
  /** 質問を出して 1 行の回答を返す。入力が終わっていれば null。 */
  ask(question: string): Promise<string | null>;
  print(line: string): void;
}

const YES = new Set(['y', 'yes']);

export function isYes(answer: string | null): boolean {
  return answer !== null && YES.has(answer.trim().toLowerCase());
}

/** 共通部: 肯定のときだけ true。 */
export async function confirm(io: Io, question: string): Promise<boolean> {
  return isYes(await io.ask(`${question} [yes/no]: `));
}

/** 7a データ消失の確認。置換や削除があるときだけ呼ぶ。 */
export async function confirmDataLoss(io: Io, report: RiskReport): Promise<boolean> {
  for (const line of describeRisks({ dataLoss: report.dataLoss, scaling: [] })) io.print(line);
  io.print('データは使い捨ての方針ですが、このデプロイで上のデータが消えます。');
  return confirm(io, 'データが消えることを承知のうえで進めますか?');
}

export interface ApprovalContext {
  account?: string;
  arn?: string;
  region: string;
  commit?: string;
  hash: string;
}

/** 7b 承認プロンプト。アカウント、リージョン、コミット、ハッシュを示して尋ねる。 */
export async function confirmApproval(io: Io, ctx: ApprovalContext): Promise<boolean> {
  io.print('--- デプロイの承認 ---');
  io.print(`アカウント: ${ctx.account ?? '(不明)'}  呼び出し元: ${ctx.arn ?? '(不明)'}`);
  io.print(`リージョン: ${ctx.region}  コミット: ${ctx.commit ?? '(不明)'}`);
  io.print(`テンプレートのハッシュ: ${ctx.hash}`);
  return confirm(io, '上の差分を本番にデプロイしますか?');
}

export interface ClosableIo extends Io {
  /** 入力を閉じる。子プロセスが標準入力を使う前に呼ぶ。 */
  close(): void;
}

/** 標準入出力を使う Io。入力が終わったとき(EOF)は null を返す。 */
export function createReadlineIo(input: Readable = process.stdin, output: Writable = process.stdout): ClosableIo {
  const rl = createInterface({ input, output, terminal: false });
  let closed = false;
  const waiting: Array<(v: string | null) => void> = [];
  const buffered: string[] = [];
  rl.on('line', (line) => {
    const w = waiting.shift();
    if (w) w(line);
    else buffered.push(line);
  });
  rl.on('close', () => {
    closed = true;
    for (const w of waiting.splice(0)) w(null);
  });
  return {
    ask(question) {
      output.write(question);
      const b = buffered.shift();
      if (b !== undefined) return Promise.resolve(b);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiting.push(resolve));
    },
    print(line) {
      output.write(`${line}\n`);
    },
    close() {
      rl.close();
    },
  };
}
