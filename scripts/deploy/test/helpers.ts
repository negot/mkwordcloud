// テスト用の共通部品。子プロセスは実行せず、呼ばれた引数を記録する。
import type { ExecResult, RunOptions, Runner } from '../src/exec.js';

export interface Call {
  mode: 'capture' | 'interactive';
  command: string;
  args: string[];
  opts?: RunOptions;
}

export type FakeRunner = Runner & { calls: Call[] };

export const ok = (stdout = ''): ExecResult => ({ code: 0, stdout, stderr: '' });
export const ng = (stderr = '', code = 1): ExecResult => ({ code, stdout: '', stderr });

export function fakeRunner(handler: (call: Call) => ExecResult | Promise<ExecResult>): FakeRunner {
  const calls: Call[] = [];
  const make =
    (mode: Call['mode']) =>
    async (command: string, args: readonly string[], opts?: RunOptions): Promise<ExecResult> => {
      const call: Call = { mode, command, args: [...args], opts };
      calls.push(call);
      const r = await handler(call);
      if (opts?.onOutput && (r.stdout || r.stderr)) opts.onOutput(r.stdout + r.stderr);
      return r;
    };
  return { calls, capture: make('capture'), interactive: make('interactive') };
}

/** 出力行を集める。 */
export function collector(): { lines: string[]; out: (l: string) => void } {
  const lines: string[] = [];
  return { lines, out: (l) => void lines.push(l) };
}

// 形式だけが合う偽の鍵(本物ではない)。
export const FAKE_ACCESS_KEY = 'AKIA' + 'ABCDEFGHIJKLMNOP';
export const FAKE_SESSION_KEY = 'ASIA' + 'ABCDEFGHIJKLMNOP';
