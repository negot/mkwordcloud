// Deployer(FR6.1、NFR1.1)。保存したテンプレートを cdk deploy に渡す。
// --require-approval never は付けない。CDK の既定の確認(権限が広がる変更)をそのまま残す。
import type { Runner } from './exec.js';
import { redact } from './redact.js';

export const OUTPUTS_FILE = 'cdk-outputs.json';

export interface DeployResult {
  /** executed: 実行した / skipped: 非対話の環境のため実行しなかった */
  status: 'executed' | 'skipped';
  ok: boolean;
  exitCode?: number;
  /** 人が CDK の確認で拒否した。 */
  rejectedByCdk: boolean;
}

export function deployArgs(assemblyDir: string): string[] {
  return ['cdk', 'deploy', '--app', assemblyDir, '--outputs-file', OUTPUTS_FILE];
}

export async function runDeploy(opts: {
  runner: Runner;
  cwd: string;
  env: NodeJS.ProcessEnv;
  assemblyDir: string;
  interactive: boolean;
  onOutput?: (chunk: string) => void;
}): Promise<DeployResult> {
  // CDK の確認に人が答えられない環境では、デプロイしない。
  if (!opts.interactive) return { status: 'skipped', ok: false, rejectedByCdk: false };
  const r = await opts.runner.interactive('npx', deployArgs(opts.assemblyDir), {
    cwd: opts.cwd,
    env: opts.env,
    onOutput: (c) => opts.onOutput?.(redact(c)),
  });
  // CDK は確認で拒否されると "Aborted by user" で終了する。
  const rejectedByCdk = r.code !== 0 && /aborted by user/i.test(`${r.stdout}\n${r.stderr}`);
  return { status: 'executed', ok: r.code === 0, exitCode: r.code, rejectedByCdk };
}
