// 流れ全体の結合テスト(FR3.1 から FR3.7、FR6.1、NFR1.1 から NFR1.5)。部品は差し替える。AWS には触れない。
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalLog } from '../src/approval-log.js';
import { LOG_FILE, type MainDeps, createDefaultDeps, runMain } from '../src/main.js';
import { collector } from './helpers.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deploy-main-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const HASH = 'a'.repeat(64);
const DIFF_SAFE = '[~] AWS::Lambda::Function HttpHandler HttpHandler1\n';
const DIFF_LOSS = '[~] AWS::DynamoDB::Table Table Table1 replace\n';

function makeDeps(over: Partial<MainDeps> = {}, opts: { logPath?: string } = {}) {
  const c = collector();
  const calls: string[] = [];
  const logPath = opts.logPath ?? join(dir, 'deploy-logs', 'approvals.jsonl');
  const track = <T>(name: string, v: T) => () => {
    calls.push(name);
    return Promise.resolve(v);
  };
  const deps: MainDeps = {
    now: () => new Date('2026-11-23T01:00:00Z'),
    user: 'dev',
    interactive: true,
    out: c.out,
    makeLog: (id) => new ApprovalLog(logPath, id, { now: () => new Date('2026-11-23T01:00:00Z') }),
    preflight: track('preflight', {
      ok: true,
      failures: [],
      region: 'ap-northeast-1',
      commit: 'abc1234567890',
      identity: { account: '111122223333', arn: 'arn:aws:sts::111122223333:assumed-role/A/b' },
    }),
    recheck: track('recheck', { ok: true, changed: [] }),
    build: track('build', { ok: true, completed: ['build:web', 'build:extension', 'typecheck', 'test'] }),
    synthDiff: track('synthDiff', { ok: true, diffText: DIFF_SAFE, assemblyDir: '/x/cdk.out.deploy', hash: HASH }),
    confirmDataLoss: track('confirmDataLoss', true),
    confirmApproval: track('confirmApproval', true),
    verify: (_d, h) => {
      calls.push('verify');
      return { approvedHash: h, currentHash: h, match: true };
    },
    deploy: track('deploy', { status: 'executed' as const, ok: true, exitCode: 0, rejectedByCdk: false }),
    reportFailure: track('reportFailure', { stackStatus: 'UPDATE_ROLLBACK_COMPLETE', failedResources: [], needsManualRecovery: false }),
    applyOutputs: track('applyOutputs', { ok: true, exitCode: 0 }),
    postCheck: track('postCheck', { ok: true, attemptsTotal: 2, items: [{ name: 'api', ok: true, attempts: 1, detail: 'HTTP 404' }] }),
    webUrl: () => 'https://w.example',
    humanCheck: track('humanCheck', {
      hasProblem: false,
      items: [
        { name: '画面表示', result: 'confirmed' as const },
        { name: 'WebSocket の接続', result: 'confirmed' as const },
        { name: '送信から表示までの動作', result: 'unchecked' as const },
      ],
    }),
    ...over,
  };
  const kinds = () =>
    readFileSync(logPath, 'utf8')
      .trimEnd()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { deps, calls, kinds, lines: c.lines, logPath };
}

describe('流れ全体(結合)', () => {
  it('経路 1: 全部成功。start、approval、deploy、postcheck、humancheck、end の順に記録し、終了コード 0', async () => {
    const t = makeDeps();
    expect(await runMain(t.deps)).toBe(0);
    const rows = t.kinds();
    expect(rows.map((r) => r.kind)).toEqual(['start', 'approval', 'deploy', 'postcheck', 'humancheck', 'end']);
    expect(new Set(rows.map((r) => r.attemptId)).size).toBe(1);
    expect(rows[0]).toMatchObject({ account: '111122223333', assemblyHash: HASH, region: 'ap-northeast-1', dataLossWarning: false });
    expect(rows[1]).toMatchObject({ decision: 'approved', hashCheck: { match: true } });
    expect(rows[5]).toMatchObject({ exitCode: 0 });
    // 承認の記録は、デプロイより前
    expect(t.calls.indexOf('confirmApproval')).toBeLessThan(t.calls.indexOf('verify'));
    expect(t.calls.indexOf('verify')).toBeLessThan(t.calls.indexOf('deploy'));
    expect(t.calls.indexOf('deploy')).toBeLessThan(t.calls.indexOf('applyOutputs'));
    expect(t.calls).not.toContain('confirmDataLoss'); // データ消失がなければ 7a は出ない
    expect(t.lines.join('\n')).toContain('合計');
  });

  it('経路 2: 事前確認の失敗は abort 行だけを書き、ビルドもデプロイもしない', async () => {
    const t = makeDeps({
      preflight: () => Promise.resolve({ ok: false, failures: ['未コミットの変更があります'], region: 'ap-northeast-1', commit: 'abc1234567890' }),
    });
    expect(await runMain(t.deps)).toBe(1);
    const rows = t.kinds();
    expect(rows.map((r) => r.kind)).toEqual(['abort']);
    expect(rows[0]).toMatchObject({ stage: '事前確認', reasons: ['未コミットの変更があります'] });
    expect(t.calls).toEqual([]);
  });

  it('経路 3: 承認の拒否は approval 行と end 行を書き、デプロイしない', async () => {
    const t = makeDeps({ confirmApproval: () => Promise.resolve(false) });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.kinds().map((r) => r.kind)).toEqual(['start', 'approval', 'end']);
    expect(t.kinds()[1]).toMatchObject({ decision: 'rejected' });
    expect(t.calls).not.toContain('deploy');
  });

  it('経路 4: ハッシュの不一致はデプロイしない。不一致を approval 行に記録する', async () => {
    const t = makeDeps({ verify: () => ({ approvedHash: HASH, currentHash: 'b'.repeat(64), match: false }) });
    expect(await runMain(t.deps)).toBe(1);
    const rows = t.kinds();
    expect(rows.map((r) => r.kind)).toEqual(['start', 'approval', 'end']);
    expect(rows[1]).toMatchObject({ decision: 'rejected', reason: 'ハッシュの不一致', hashCheck: { match: false, currentHash: 'b'.repeat(64) } });
    expect(t.calls).not.toContain('deploy');
  });

  it('経路 5: デプロイの失敗は失敗を報告し、deploy 行と end 行を書く', async () => {
    const t = makeDeps({ deploy: () => Promise.resolve({ status: 'executed', ok: false, exitCode: 1, rejectedByCdk: false }) });
    expect(await runMain(t.deps)).toBe(1);
    const rows = t.kinds();
    expect(rows.map((r) => r.kind)).toEqual(['start', 'approval', 'deploy', 'end']);
    expect(rows[2]).toMatchObject({ result: 'failed', stackStatus: 'UPDATE_ROLLBACK_COMPLETE' });
    expect(t.calls).toContain('reportFailure');
    expect(t.calls).not.toContain('applyOutputs');
  });
});

describe('流れ全体: その他の経路', () => {
  it('データ消失のおそれがあれば 7a を先に尋ね、承知しなければ approval 行と end 行で終わる', async () => {
    const t = makeDeps({
      synthDiff: () => Promise.resolve({ ok: true, diffText: DIFF_LOSS, assemblyDir: '/x', hash: HASH }),
      confirmDataLoss: () => Promise.resolve(false),
    });
    expect(await runMain(t.deps)).toBe(1);
    const rows = t.kinds();
    expect(rows.map((r) => r.kind)).toEqual(['start', 'approval', 'end']);
    expect(rows[0]).toMatchObject({ dataLossWarning: true });
    expect(rows[1]).toMatchObject({ dataLossAnswer: 'no', decision: 'rejected' });
    expect(t.calls).not.toContain('confirmApproval');
  });

  it('データ消失を承知したうえで承認すると進み、回答を記録する', async () => {
    const t = makeDeps({ synthDiff: () => Promise.resolve({ ok: true, diffText: DIFF_LOSS, assemblyDir: '/x', hash: HASH }) });
    expect(await runMain(t.deps)).toBe(0);
    expect(t.kinds()[1]).toMatchObject({ dataLossAnswer: 'yes', decision: 'approved' });
  });

  it('ビルドの失敗、再確認の失敗、テンプレート生成の失敗は abort 行だけを書く', async () => {
    const b = makeDeps({ build: () => Promise.resolve({ ok: false, failedStep: 'test', exitCode: 1, completed: [] }) });
    expect(await runMain(b.deps)).toBe(1);
    expect(b.kinds()).toHaveLength(1);
    expect(b.kinds()[0]).toMatchObject({ kind: 'abort', stage: 'ビルドと検証' });

    const r = makeDeps(
      { recheck: () => Promise.resolve({ ok: false, changed: ['package-lock.json'] }) },
      { logPath: join(dir, 'r.jsonl') },
    );
    expect(await runMain(r.deps)).toBe(1);
    expect(r.kinds()[0]).toMatchObject({ kind: 'abort', stage: '再確認' });
    expect(JSON.stringify(r.kinds()[0])).toContain('package-lock.json');

    const s = makeDeps(
      { synthDiff: () => Promise.resolve({ ok: false, failedStage: 'synth', error: 'boom', diffText: '', assemblyDir: '/x' }) },
      { logPath: join(dir, 's.jsonl') },
    );
    expect(await runMain(s.deps)).toBe(1);
    expect(s.kinds()[0]).toMatchObject({ kind: 'abort', stage: 'テンプレート生成と差分' });
    expect(s.calls).not.toContain('deploy');
  });

  it('start 行を書けないときは、デプロイせず画面に表示して終了する', async () => {
    const t = makeDeps({}, { logPath: dir }); // 保存先がディレクトリ: 書けない
    expect(await runMain(t.deps)).toBe(1);
    expect(t.calls).not.toContain('confirmApproval');
    expect(t.calls).not.toContain('deploy');
    expect(t.lines.join('\n')).toContain('承認ログに書けませんでした');
    expect(t.lines.join('\n')).toContain('開始の記録を残せない');
  });

  it('approval 行を書けないときはデプロイしない', async () => {
    let n = 0;
    const t = makeDeps({
      makeLog: () => ({
        append: (kind) => {
          n++;
          return kind === 'approval' ? { ok: false as const, error: 'disk full' } : { ok: true as const };
        },
      }),
    });
    expect(await runMain(t.deps)).toBe(1);
    expect(n).toBe(1 + 1); // start と approval
    expect(t.calls).not.toContain('deploy');
    expect(t.lines.join('\n')).toContain('承認の記録を残せない');
  });

  it('承認の拒否の approval 行を書けないときも、非ゼロで終了する', async () => {
    const t = makeDeps({
      confirmApproval: () => Promise.resolve(false),
      makeLog: () => ({ append: (k) => (k === 'approval' ? { ok: false as const, error: 'x' } : { ok: true as const }) }),
    });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.lines.join('\n')).toContain('承認の判断を記録できませんでした');
  });

  it('非対話の環境では何も実行せず、ログも書かない', async () => {
    const t = makeDeps({ interactive: false });
    expect(await runMain(t.deps)).toBe(2);
    expect(t.calls).toEqual([]);
    expect(t.lines.join('\n')).toContain('対話できない環境');
  });

  it('CDK の確認で拒否されたら、deploy 行に記録して終了する(失敗の報告はしない)', async () => {
    const t = makeDeps({ deploy: () => Promise.resolve({ status: 'executed', ok: false, exitCode: 1, rejectedByCdk: true }) });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.kinds()[2]).toMatchObject({ kind: 'deploy', result: 'rejected-by-cdk', rejectedByCdk: true });
    expect(t.calls).not.toContain('reportFailure');
  });

  it('非対話でデプロイが実行されなかったときは skipped として記録する', async () => {
    const t = makeDeps({ deploy: () => Promise.resolve({ status: 'skipped', ok: false, rejectedByCdk: false }) });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.kinds()[2]).toMatchObject({ result: 'skipped' });
  });

  it('apply-outputs の失敗は end 行つきで非ゼロ', async () => {
    const t = makeDeps({ applyOutputs: () => Promise.resolve({ ok: false, exitCode: 1 }) });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.kinds().map((r) => r.kind)).toEqual(['start', 'approval', 'deploy', 'end']);
    expect(t.calls).not.toContain('postCheck');
  });

  it('自動確認の失敗は postcheck 行と end 行で非ゼロ。人による確認には進まない', async () => {
    const t = makeDeps({
      postCheck: () => Promise.resolve({ ok: false, attemptsTotal: 12, items: [{ name: 'web', ok: false, attempts: 6, detail: 'HTTP 500' }] }),
    });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.kinds().map((r) => r.kind)).toEqual(['start', 'approval', 'deploy', 'postcheck', 'end']);
    expect(t.calls).not.toContain('humanCheck');
  });

  it('出力ファイルが読めないなどで自動確認が例外になっても、失敗として記録する', async () => {
    const t = makeDeps({ postCheck: () => Promise.reject(new Error('出力ファイルを読めません')) });
    expect(await runMain(t.deps)).toBe(1);
    expect(JSON.stringify(t.kinds()[3])).toContain('出力ファイルを読めません');
  });

  it('人による確認で「問題があった」なら非ゼロ。「確認しなかった」だけなら 0', async () => {
    const t = makeDeps({
      humanCheck: () => Promise.resolve({ hasProblem: true, items: [{ name: '画面表示', result: 'problem' as const }] }),
    });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.kinds()[4]).toMatchObject({ kind: 'humancheck', hasProblem: true });
    expect(t.kinds()[5]).toMatchObject({ exitCode: 1 });
  });

  it('デプロイ後の結果の行を書けないときは、警告して非ゼロで終了する', async () => {
    const t = makeDeps({
      makeLog: () => ({ append: (k) => (k === 'postcheck' ? { ok: false as const, error: 'x' } : { ok: true as const }) }),
    });
    expect(await runMain(t.deps)).toBe(1);
    expect(t.lines.join('\n')).toContain('承認ログに書けませんでした(postcheck 行)');
  });

  it('画面の出力に秘密情報を残さない(abort の理由)', async () => {
    const t = makeDeps({
      preflight: () => Promise.resolve({ ok: false, failures: ['x aws_session_token=tok999'], region: 'r' }),
    });
    await runMain(t.deps);
    expect(readFileSync(t.logPath, 'utf8')).not.toContain('tok999');
  });
});

describe('createDefaultDeps', () => {
  it('実際の部品をつなぎ、承認ログの保存先は deploy-logs/approvals.jsonl', () => {
    const d = createDefaultDeps(dir, {});
    expect(LOG_FILE).toBe('deploy-logs/approvals.jsonl');
    expect(typeof d.user).toBe('string');
    expect(d.webUrl()).toBeUndefined(); // cdk-outputs.json がない
    const log = d.makeLog('A1');
    expect(log.append('end', { exitCode: 0 }).ok).toBe(true);
    expect(readFileSync(join(dir, LOG_FILE), 'utf8')).toContain('"attemptId":"A1"');
    expect(d.verify).toBeTypeOf('function');
  });
});
