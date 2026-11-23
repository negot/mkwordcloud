// Deployer と FailureReporter のテスト(FR6.1、FR6.2、NFR1.1、NFR5.6、NFR5.7)
import { describe, expect, it } from 'vitest';
import { AwsCli } from '../src/aws-cli.js';
import { deployArgs, runDeploy } from '../src/deployer.js';
import { reportFailure } from '../src/failure-report.js';
import { FAKE_ACCESS_KEY, collector, fakeRunner, ng, ok } from './helpers.js';

const base = { cwd: '/repo', env: {} as NodeJS.ProcessEnv, assemblyDir: '/repo/cdk.out.deploy' };

describe('Deployer', () => {
  it('--require-approval never を付けず、保存先と出力ファイルを渡す', async () => {
    const r = fakeRunner(() => ok('done'));
    const res = await runDeploy({ ...base, runner: r, interactive: true });
    expect(res).toEqual({ status: 'executed', ok: true, exitCode: 0, rejectedByCdk: false });
    expect(r.calls).toHaveLength(1);
    const call = r.calls[0];
    expect(call.mode).toBe('interactive'); // 標準入力を引き継ぐ(CDK の確認に人が答える)
    expect(call.command).toBe('npx');
    expect(call.args).toEqual(['cdk', 'deploy', '--app', '/repo/cdk.out.deploy', '--outputs-file', 'cdk-outputs.json']);
    expect(call.args.join(' ')).not.toContain('require-approval');
    expect(call.args.join(' ')).not.toContain('never');
  });

  it('deployArgs は保存先をそのまま渡す(再生成しない)', () => {
    expect(deployArgs('x')).toContain('x');
    expect(deployArgs('x')).not.toContain('synth');
  });

  it('CDK の確認で拒否されたら、拒否として扱う', async () => {
    const r = fakeRunner(() => ng('Aborted by user', 1));
    const res = await runDeploy({ ...base, runner: r, interactive: true });
    expect(res.ok).toBe(false);
    expect(res.rejectedByCdk).toBe(true);
  });

  it('デプロイの失敗(拒否ではない)は rejectedByCdk にしない', async () => {
    const r = fakeRunner(() => ng('UPDATE_FAILED', 1));
    const res = await runDeploy({ ...base, runner: r, interactive: true });
    expect(res).toMatchObject({ ok: false, exitCode: 1, rejectedByCdk: false });
  });

  it('非対話の環境では実行しない', async () => {
    const r = fakeRunner(() => ok());
    const res = await runDeploy({ ...base, runner: r, interactive: false });
    expect(res).toEqual({ status: 'skipped', ok: false, rejectedByCdk: false });
    expect(r.calls).toHaveLength(0);
  });

  it('画面に出す出力は伏せ字にする', async () => {
    const chunks: string[] = [];
    const r = fakeRunner(() => ok(`key ${FAKE_ACCESS_KEY}`));
    await runDeploy({ ...base, runner: r, interactive: true, onOutput: (c) => chunks.push(c) });
    expect(chunks.join('')).not.toContain(FAKE_ACCESS_KEY);
    expect(chunks.join('')).toContain('[REDACTED]');
  });

  it('onOutput がなくても動く', async () => {
    const r = fakeRunner(() => ok('x'));
    expect((await runDeploy({ ...base, runner: r, interactive: true })).ok).toBe(true);
  });
});

function awsWith(status: string | null, events: unknown[], fail = false) {
  return new AwsCli(
    fakeRunner((c) => {
      if (fail) return ng('AccessDenied for ' + FAKE_ACCESS_KEY);
      if (c.args[1] === 'describe-stacks') return status === null ? ng('does not exist') : ok(JSON.stringify({ Stacks: [{ StackStatus: status }] }));
      return ok(JSON.stringify({ StackEvents: events }));
    }),
  );
}

describe('FailureReporter', () => {
  it('スタックの状態と、失敗したリソースとその理由を表示する', async () => {
    const c = collector();
    const s = await reportFailure({
      aws: awsWith('UPDATE_ROLLBACK_COMPLETE', [
        { LogicalResourceId: 'HttpHandler', ResourceStatus: 'UPDATE_FAILED', ResourceStatusReason: 'Resource handler returned message: timeout' },
      ]),
      region: 'ap-northeast-1',
      out: c.out,
    });
    const text = c.lines.join('\n');
    expect(text).toContain('UPDATE_ROLLBACK_COMPLETE');
    expect(text).toContain('HttpHandler');
    expect(text).toContain('timeout');
    expect(s.failedResources).toHaveLength(1);
    expect(s.needsManualRecovery).toBe(false);
  });

  it('UPDATE_ROLLBACK_FAILED のときは手作業の復旧を案内する', async () => {
    const c = collector();
    const s = await reportFailure({ aws: awsWith('UPDATE_ROLLBACK_FAILED', []), region: 'r', out: c.out });
    expect(s.needsManualRecovery).toBe(true);
    expect(c.lines.join('\n')).toContain('docs/deploy.md');
    expect(c.lines.join('\n')).toContain('見つかりませんでした');
  });

  it('取得に失敗しても例外にせず、確認先を案内する(鍵は伏せる)', async () => {
    const c = collector();
    const s = await reportFailure({ aws: awsWith(null, [], true), region: 'r', out: c.out });
    expect(s.error).toBeDefined();
    expect(c.lines.join('\n')).toContain('CloudFormation');
    expect(c.lines.join('\n')).not.toContain(FAKE_ACCESS_KEY);
  });

  it('スタックがないときの表示', async () => {
    const c = collector();
    const s = await reportFailure({ aws: awsWith(null, []), region: 'r', out: c.out });
    expect(s.stackStatus).toBeNull();
    expect(c.lines.join('\n')).toContain('スタックなし');
  });
});
