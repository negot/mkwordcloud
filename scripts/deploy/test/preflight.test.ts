// Preflight のテスト(FR3.7、NFR1.2、NFR3.5)
import { describe, expect, it } from 'vitest';
import { AwsCli } from '../src/aws-cli.js';
import { isValidProfile, isValidRegion, recheckTracked, runPreflight } from '../src/preflight.js';
import { type Call, fakeRunner, ng, ok } from './helpers.js';

interface Scenario {
  porcelain?: string;
  sts?: 'ok' | 'expired';
  toolkit?: string | null;
  stack?: string | null;
}

function build(s: Scenario = {}, env: NodeJS.ProcessEnv = {}) {
  const runner = fakeRunner((c: Call) => {
    if (c.command === 'git' && c.args[0] === 'status') return ok(s.porcelain ?? '');
    if (c.command === 'git' && c.args[0] === 'rev-parse') return ok('abc123def456\n');
    if (c.args[0] === 'sts') {
      return s.sts === 'expired'
        ? ng('The SSO session associated with this profile has expired', 255)
        : ok(JSON.stringify({ Account: '111122223333', Arn: 'arn:aws:sts::111122223333:assumed-role/Admin/dev' }));
    }
    if (c.args[0] === 'cloudformation') {
      const name = c.args[c.args.indexOf('--stack-name') + 1];
      const st = name === 'CDKToolkit' ? (s.toolkit === undefined ? 'CREATE_COMPLETE' : s.toolkit) : s.stack === undefined ? 'UPDATE_COMPLETE' : s.stack;
      return st === null ? ng('Stack with id x does not exist') : ok(JSON.stringify({ Stacks: [{ StackStatus: st }] }));
    }
    return ng('unexpected');
  });
  return { runner, deps: { runner, aws: new AwsCli(runner), env, cwd: '/repo' } };
}

describe('Preflight', () => {
  it('全部成功: アカウント、呼び出し元、コミット、スタックの状態を返す', async () => {
    const { deps } = build();
    const r = await runPreflight(deps);
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.region).toBe('ap-northeast-1');
    expect(r.identity?.account).toBe('111122223333');
    expect(r.commit).toBe('abc123def456');
    expect(r.stackStatus).toBe('UPDATE_COMPLETE');
  });

  it('確認は AWS を変更するコマンドを使わない(読み取りだけ)', async () => {
    const { deps, runner } = build();
    await runPreflight(deps);
    const verbs = runner.calls.filter((c) => c.command === 'aws').map((c) => c.args.slice(0, 2).join(' '));
    expect(new Set(verbs)).toEqual(new Set(['sts get-caller-identity', 'cloudformation describe-stacks']));
  });

  it('未コミットの変更(未追跡を含む)があれば失敗し、ログと保存先は除く', async () => {
    const { deps } = build({ porcelain: ' M scripts/build-web.mjs\n?? feature.md\n?? deploy-logs/approvals.jsonl\n?? cdk.out.deploy/x\n' });
    const r = await runPreflight(deps);
    expect(r.ok).toBe(false);
    const msg = r.failures.join('\n');
    expect(msg).toContain('未コミットの変更');
    expect(msg).toContain('scripts/build-web.mjs');
    expect(msg).toContain('feature.md');
    expect(msg).not.toContain('approvals.jsonl');
  });

  it('除外対象だけが変わっているときは未コミットとみなさない', async () => {
    const { deps } = build({ porcelain: '?? deploy-logs/approvals.jsonl\n' });
    expect((await runPreflight(deps)).ok).toBe(true);
  });

  it('ブートストラップがなければ失敗する', async () => {
    const { deps } = build({ toolkit: null });
    const r = await runPreflight(deps);
    expect(r.ok).toBe(false);
    expect(r.failures.join('')).toContain('ブートストラップ');
  });

  it.each(['UPDATE_ROLLBACK_FAILED', 'UPDATE_IN_PROGRESS', 'ROLLBACK_COMPLETE', 'DELETE_FAILED'])(
    'スタックが %s なら更新できない',
    async (status) => {
      const { deps } = build({ stack: status });
      const r = await runPreflight(deps);
      expect(r.ok).toBe(false);
      expect(r.failures.join('')).toContain(status);
    },
  );

  it('スタックがまだなければ(初回)更新できるとみなす', async () => {
    const { deps } = build({ stack: null });
    const r = await runPreflight(deps);
    expect(r.ok).toBe(true);
    expect(r.stackStatus).toBeNull();
  });

  it('リージョンの形式が不正なら AWS を呼ばずに失敗する', async () => {
    const { deps, runner } = build({}, { WORDCLOUD_REGION: 'tokyo; rm -rf /' });
    const r = await runPreflight(deps);
    expect(r.ok).toBe(false);
    expect(r.failures.join('')).toContain('WORDCLOUD_REGION');
    expect(runner.calls.some((c) => c.command === 'aws')).toBe(false);
  });

  it('AWS_PROFILE の形式が不正なら失敗する', async () => {
    const { deps } = build({}, { AWS_PROFILE: 'a b$(x)' });
    const r = await runPreflight(deps);
    expect(r.ok).toBe(false);
    expect(r.failures.join('')).toContain('AWS_PROFILE');
  });

  it('認証切れなら失敗し、サインインを案内する', async () => {
    const { deps } = build({ sts: 'expired' });
    const r = await runPreflight(deps);
    expect(r.ok).toBe(false);
    expect(r.failures.join('')).toContain('IAM Identity Center');
  });

  it('WORDCLOUD_REGION が正しければそのリージョンを使う', async () => {
    const { deps, runner } = build({}, { WORDCLOUD_REGION: 'us-east-1' });
    const r = await runPreflight(deps);
    expect(r.region).toBe('us-east-1');
    expect(runner.calls.some((c) => c.args.includes('us-east-1'))).toBe(true);
  });

  it('git が使えないときは失敗する', async () => {
    const runner = fakeRunner((c) => {
      if (c.command === 'git') return ng('not a git repository', 128);
      return ok(JSON.stringify({ Account: '1', Arn: 'a', Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }] }));
    });
    const r = await runPreflight({ runner, aws: new AwsCli(runner), env: {}, cwd: '/x' });
    expect(r.ok).toBe(false);
    expect(r.failures.join('')).toContain('git status');
    expect(r.failures.join('')).toContain('コミットのハッシュ');
  });
});

describe('recheckTracked(ビルド後の再確認)', () => {
  it('変更なしなら ok。未追跡は見ない(--untracked-files=no)', async () => {
    const { deps, runner } = build({ porcelain: '' });
    expect(await recheckTracked(deps)).toEqual({ ok: true, changed: [] });
    expect(runner.calls[0].args).toContain('--untracked-files=no');
  });

  it('追跡対象の変更を検出して一覧にする', async () => {
    const { deps } = build({ porcelain: ' M package-lock.json\n' });
    const r = await recheckTracked(deps);
    expect(r.ok).toBe(false);
    expect(r.changed).toEqual(['package-lock.json']);
  });

  it('git が失敗したら ok にしない', async () => {
    const runner = fakeRunner(() => ng('fatal', 128));
    const r = await recheckTracked({ runner, aws: new AwsCli(runner), env: {}, cwd: '/x' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('git status');
  });
});

describe('形式の検証', () => {
  it('リージョンとプロファイル', () => {
    expect(isValidRegion('ap-northeast-1')).toBe(true);
    expect(isValidRegion('us-gov-west-1')).toBe(true);
    expect(isValidRegion('AP-NORTHEAST-1')).toBe(false);
    expect(isValidRegion('')).toBe(false);
    expect(isValidProfile('my-sso_profile.1')).toBe(true);
    expect(isValidProfile('x y')).toBe(false);
  });
});
