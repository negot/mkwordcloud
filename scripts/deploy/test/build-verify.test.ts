// BuildVerify のテスト(FR3.4、NFR1.3)
import { describe, expect, it } from 'vitest';
import { BUILD_STEPS, runBuildVerify } from '../src/build-verify.js';
import { fakeRunner, ng, ok } from './helpers.js';

const base = { cwd: '/repo', env: {} as NodeJS.ProcessEnv };

describe('BuildVerify', () => {
  it('build:web、build:extension、typecheck、test の順に実行する', async () => {
    const r = fakeRunner(() => ok());
    const steps: string[] = [];
    const res = await runBuildVerify(r, { ...base, onStep: (n) => steps.push(n) });
    expect(res).toEqual({ ok: true, completed: ['build:web', 'build:extension', 'typecheck', 'test'] });
    expect(r.calls.map((c) => [c.command, ...c.args].join(' '))).toEqual([
      'npm run build:web',
      'npm run build:extension',
      'npm run typecheck',
      'npm test',
    ]);
    expect(steps).toEqual(['build:web', 'build:extension', 'typecheck', 'test']);
  });

  it('途中で失敗したら、以降を実行しない', async () => {
    const r = fakeRunner((c) => (c.args.includes('typecheck') ? ng('TS2322', 2) : ok()));
    const res = await runBuildVerify(r, base);
    expect(res.ok).toBe(false);
    expect(res.failedStep).toBe('typecheck');
    expect(res.completed).toEqual(['build:web', 'build:extension']);
    expect(r.calls).toHaveLength(3);
  });

  it('終了コードを伝える', async () => {
    const r = fakeRunner(() => ng('x', 7));
    const res = await runBuildVerify(r, base);
    expect(res).toEqual({ ok: false, failedStep: 'build:web', exitCode: 7, completed: [] });
  });

  it('出力を onOutput へ渡し、cwd と env を引き継ぐ', async () => {
    const chunks: string[] = [];
    const r = fakeRunner(() => ok('built'));
    await runBuildVerify(r, { cwd: '/repo', env: { A: '1' }, onOutput: (c) => chunks.push(c) });
    expect(chunks.length).toBe(4);
    expect(r.calls[0].opts?.cwd).toBe('/repo');
    expect(r.calls[0].opts?.env).toEqual({ A: '1' });
  });

  it('手順の定義は 4 つで、シェルを使わない配列引数', () => {
    expect(BUILD_STEPS).toHaveLength(4);
    for (const s of BUILD_STEPS) expect(Array.isArray(s.args)).toBe(true);
  });
});
