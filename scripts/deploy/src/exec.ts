// 子プロセスの実行(NFR2.3)。シェルを経由せず、引数の配列で渡す。
// テストでは Runner を差し替えて、実際のコマンドを実行しない。
import { spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** 出力の断片を受け取る(画面に伏せ字つきで表示するために使う)。 */
  onOutput?: (chunk: string) => void;
}

export interface Runner {
  /** 標準入力を使わず、出力を取得する実行。 */
  capture(command: string, args: readonly string[], opts?: RunOptions): Promise<ExecResult>;
  /** 標準入力を引き継ぐ実行(CDK の対話確認用)。出力は取得しつつ onOutput へ流す。 */
  interactive(command: string, args: readonly string[], opts?: RunOptions): Promise<ExecResult>;
}

function run(
  command: string,
  args: readonly string[],
  opts: RunOptions,
  stdin: 'ignore' | 'inherit',
): Promise<ExecResult> {
  return new Promise((resolve) => {
    // shell: false(既定)。引数は配列のまま渡る。
    const child = spawn(command, [...args], {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: [stdin, 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (b: Buffer) => {
      const s = b.toString('utf8');
      stdout += s;
      opts.onOutput?.(s);
    });
    child.stderr?.on('data', (b: Buffer) => {
      const s = b.toString('utf8');
      stderr += s;
      opts.onOutput?.(s);
    });
    child.on('error', (e) => {
      // 起動できない(コマンドがない等)。終了コード 127 として扱う。
      resolve({ code: 127, stdout, stderr: `${stderr}${e.message}` });
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export function createRunner(): Runner {
  return {
    capture: (command, args, opts = {}) => run(command, args, opts, 'ignore'),
    interactive: (command, args, opts = {}) => run(command, args, opts, 'inherit'),
  };
}
