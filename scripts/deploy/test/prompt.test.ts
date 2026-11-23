// ApprovalPrompter と HumanCheck のテスト(FR3.2、FR3.6、FR5.3 から FR5.5、NFR1.5)
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { parseHumanAnswer, runHumanCheck } from '../src/human-check.js';
import { type Io, confirm, confirmApproval, confirmDataLoss, createReadlineIo, isYes } from '../src/prompter.js';
import type { RiskReport } from '../src/risk-detector.js';

/** あらかじめ決めた回答の列を返す Io。 */
function scripted(answers: Array<string | null>): Io & { printed: string[]; asked: string[] } {
  const printed: string[] = [];
  const asked: string[] = [];
  let i = 0;
  return {
    printed,
    asked,
    print: (l) => void printed.push(l),
    ask: async (q) => {
      asked.push(q);
      return i < answers.length ? answers[i++] : null;
    },
  };
}

describe('ApprovalPrompter', () => {
  it.each(['y', 'yes', 'YES', ' Yes '])('肯定: %j', async (a) => {
    expect(await confirm(scripted([a]), '進めますか?')).toBe(true);
  });

  it.each(['n', 'no', 'はい', 'yep', '1', '', 'yes please', 'ｙ'])('否定または不正な入力は「いいえ」: %j', async (a) => {
    expect(await confirm(scripted([a]), '進めますか?')).toBe(false);
  });

  it('無回答(入力の終了)は「いいえ」', async () => {
    expect(await confirm(scripted([null]), '進めますか?')).toBe(false);
    expect(isYes(null)).toBe(false);
  });

  it('データ消失の確認は、対象のリソースを表示してから尋ねる', async () => {
    const report: RiskReport = {
      dataLoss: [{ resourceType: 'AWS::DynamoDB::Table', logicalId: 'Table', action: 'replace' }],
      scaling: [{ logicalId: 'X', line: 'BillingMode' }],
    };
    const io = scripted(['yes']);
    expect(await confirmDataLoss(io, report)).toBe(true);
    const text = io.printed.join('\n');
    expect(text).toContain('AWS::DynamoDB::Table');
    expect(text).not.toContain('BillingMode'); // スケーリングの警告は差分の表示側で扱う
    expect(io.asked[0]).toContain('承知');
  });

  it('承認プロンプトは、アカウント、リージョン、コミット、ハッシュを示す', async () => {
    const io = scripted(['y']);
    const ok = await confirmApproval(io, {
      account: '111122223333',
      arn: 'arn:aws:sts::111122223333:assumed-role/A/b',
      region: 'ap-northeast-1',
      commit: 'abc123',
      hash: 'f'.repeat(64),
    });
    expect(ok).toBe(true);
    const text = io.printed.join('\n');
    for (const s of ['111122223333', 'ap-northeast-1', 'abc123', 'f'.repeat(64)]) expect(text).toContain(s);
  });

  it('承認プロンプトの拒否と、情報が欠けているときの表示', async () => {
    const io = scripted(['no']);
    expect(await confirmApproval(io, { region: 'ap-northeast-1', hash: 'h' })).toBe(false);
    expect(io.printed.join('\n')).toContain('(不明)');
  });
});

describe('createReadlineIo', () => {
  it('入力の行を順に返し、終了後は null を返す', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const io = createReadlineIo(input, output);
    const p1 = io.ask('Q1: ');
    input.write('yes\n');
    expect(await p1).toBe('yes');
    input.write('buffered\n');
    await new Promise((r) => setTimeout(r, 10));
    expect(await io.ask('Q2: ')).toBe('buffered');
    const p3 = io.ask('Q3: ');
    input.end();
    expect(await p3).toBeNull();
    expect(await io.ask('Q4: ')).toBeNull();
    io.print('done');
    expect(output.read().toString()).toContain('Q1: ');
  });
});

describe('HumanCheck', () => {
  it('3 項目を 1 つずつ尋ねて記録する。URL を表示する', async () => {
    const io = scripted(['1', '1', '1']);
    const r = await runHumanCheck(io, 'https://d123.cloudfront.net');
    expect(r.items.map((i) => i.result)).toEqual(['confirmed', 'confirmed', 'confirmed']);
    expect(r.hasProblem).toBe(false);
    expect(io.asked).toHaveLength(3);
    expect(io.printed.join('\n')).toContain('https://d123.cloudfront.net');
    expect(io.printed.join('\n')).toContain('ブラウザは自動では開きません');
  });

  it('「確認しなかった」は失敗にならない(未確認)', async () => {
    const r = await runHumanCheck(scripted(['2', '確認しなかった', '2']), undefined);
    expect(r.items.every((i) => i.result === 'unchecked')).toBe(true);
    expect(r.hasProblem).toBe(false);
  });

  it('「問題があった」が 1 つでもあれば問題ありにする', async () => {
    const r = await runHumanCheck(scripted(['1', '3', '2']), 'u');
    expect(r.hasProblem).toBe(true);
    expect(r.items[1]).toEqual({ name: 'WebSocket の接続', result: 'problem' });
  });

  it('不正な入力と無回答は「確認した」にしない', async () => {
    const r = await runHumanCheck(scripted(['ok!', null]), 'u');
    expect(r.items.map((i) => i.result)).toEqual(['unchecked', 'unchecked', 'unchecked']);
    expect(parseHumanAnswer('確認した')).toBe('confirmed');
    expect(parseHumanAnswer('問題があった')).toBe('problem');
  });
});
