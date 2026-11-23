// ビルドと検証(FR3.4、NFR1.3、NFR4.2、NFR6.1)。順に実行し、失敗したら以降を実行しない。
import type { Runner } from './exec.js';

export interface BuildStep {
  name: string;
  command: string;
  args: string[];
}

/** 実行の順序。build:web を先に行うのは、packages/web/dist がないと placeholder が配置されるため。 */
export const BUILD_STEPS: readonly BuildStep[] = [
  { name: 'build:web', command: 'npm', args: ['run', 'build:web'] },
  { name: 'build:extension', command: 'npm', args: ['run', 'build:extension'] },
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'test', command: 'npm', args: ['test'] },
];

export interface BuildResult {
  ok: boolean;
  failedStep?: string;
  exitCode?: number;
  completed: string[];
}

export async function runBuildVerify(
  runner: Runner,
  opts: { cwd: string; env: NodeJS.ProcessEnv; onOutput?: (chunk: string) => void; onStep?: (name: string) => void },
): Promise<BuildResult> {
  const completed: string[] = [];
  for (const step of BUILD_STEPS) {
    opts.onStep?.(step.name);
    const r = await runner.capture(step.command, step.args, { cwd: opts.cwd, env: opts.env, onOutput: opts.onOutput });
    if (r.code !== 0) return { ok: false, failedStep: step.name, exitCode: r.code, completed };
    completed.push(step.name);
  }
  return { ok: true, completed };
}
