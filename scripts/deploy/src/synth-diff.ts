// テンプレート生成と差分(FR3.2、NFR1.1)。cdk synth を一度だけ実行して保存先に作り、
// 同じ保存先に対して cdk diff を実行する。ハッシュ(承認時のハッシュ)をここで計算する。
import { rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { computeAssemblyHash } from './assembly-hash.js';
import type { Runner } from './exec.js';
import { redact } from './redact.js';

export const ASSEMBLY_DIR = 'cdk.out.deploy';

export interface SynthDiffResult {
  ok: boolean;
  /** 失敗した段階(synth または diff)。 */
  failedStage?: 'synth' | 'diff';
  error?: string;
  diffText: string;
  assemblyDir: string;
  hash?: string;
}

export async function runSynthDiff(opts: {
  runner: Runner;
  cwd: string;
  env: NodeJS.ProcessEnv;
  assemblyDir?: string;
}): Promise<SynthDiffResult> {
  const assemblyDir = resolve(opts.cwd, opts.assemblyDir ?? ASSEMBLY_DIR);
  // 誤って別のディレクトリを消さないよう、名前を確かめる。
  if (basename(assemblyDir) !== ASSEMBLY_DIR) {
    return { ok: false, failedStage: 'synth', error: `保存先の名前が ${ASSEMBLY_DIR} ではありません`, diffText: '', assemblyDir };
  }
  rmSync(assemblyDir, { recursive: true, force: true });

  const callOpts = { cwd: opts.cwd, env: opts.env };
  const synth = await opts.runner.capture(
    'npx',
    ['cdk', 'synth', '--app', 'npx tsx infra/bin/app.ts', '--output', assemblyDir],
    callOpts,
  );
  if (synth.code !== 0) {
    return { ok: false, failedStage: 'synth', error: redact(synth.stderr.trim()), diffText: '', assemblyDir };
  }

  const diff = await opts.runner.capture('npx', ['cdk', 'diff', '--app', assemblyDir], callOpts);
  if (diff.code !== 0) {
    return { ok: false, failedStage: 'diff', error: redact(diff.stderr.trim()), diffText: '', assemblyDir };
  }
  // cdk diff は差分を標準エラーに出すことがある。両方をまとめる。
  const diffText = redact(`${diff.stdout}\n${diff.stderr}`.trim());
  return { ok: true, diffText, assemblyDir, hash: computeAssemblyHash(assemblyDir) };
}
