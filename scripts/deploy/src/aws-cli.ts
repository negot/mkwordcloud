// AWS CLI を呼ぶ薄い層(Q7 A、NFR2.3)。認証情報は自分では読まない。AWS CLI が AWS_PROFILE を使う。
// 失敗の文言は、呼び出し元が表示する前に伏せ字にする。
import type { Runner } from './exec.js';
import { redact } from './redact.js';

export interface CallerIdentity {
  account: string;
  arn: string;
}

export interface StackEvent {
  logicalId: string;
  status: string;
  reason: string;
}

export class AwsCliError extends Error {}

export class AwsCli {
  constructor(
    private readonly runner: Runner,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  private async json(args: string[]): Promise<unknown> {
    const r = await this.runner.capture('aws', args, { env: this.env });
    if (r.code !== 0) {
      throw new AwsCliError(redact(r.stderr.trim() || `aws が終了コード ${r.code} で終了しました`));
    }
    try {
      return JSON.parse(r.stdout);
    } catch {
      throw new AwsCliError('aws の出力を JSON として読めません');
    }
  }

  /** STS の呼び出し元(アカウント ID と ARN)。認証が切れていれば AwsCliError。 */
  async callerIdentity(): Promise<CallerIdentity> {
    const j = (await this.json(['sts', 'get-caller-identity', '--output', 'json'])) as {
      Account?: unknown;
      Arn?: unknown;
    };
    if (typeof j.Account !== 'string' || typeof j.Arn !== 'string') {
      throw new AwsCliError('STS の応答にアカウント ID または ARN がありません');
    }
    return { account: j.Account, arn: j.Arn };
  }

  /** スタックの状態。存在しないときは null。 */
  async stackStatus(stackName: string, region: string): Promise<string | null> {
    const r = await this.runner.capture(
      'aws',
      ['cloudformation', 'describe-stacks', '--stack-name', stackName, '--region', region, '--output', 'json'],
      { env: this.env },
    );
    if (r.code !== 0) {
      if (/does not exist/i.test(r.stderr)) return null;
      throw new AwsCliError(redact(r.stderr.trim() || `aws が終了コード ${r.code} で終了しました`));
    }
    let parsed: { Stacks?: Array<{ StackStatus?: unknown }> };
    try {
      parsed = JSON.parse(r.stdout);
    } catch {
      throw new AwsCliError('aws の出力を JSON として読めません');
    }
    const status = parsed.Stacks?.[0]?.StackStatus;
    if (typeof status !== 'string') throw new AwsCliError('スタックの状態を読めません');
    return status;
  }

  /** 失敗したリソースのイベント(新しい順、最大 limit 件)。 */
  async failedEvents(stackName: string, region: string, limit = 10): Promise<StackEvent[]> {
    const j = (await this.json([
      'cloudformation',
      'describe-stack-events',
      '--stack-name',
      stackName,
      '--region',
      region,
      '--output',
      'json',
    ])) as {
      StackEvents?: Array<{ LogicalResourceId?: string; ResourceStatus?: string; ResourceStatusReason?: string }>;
    };
    const events = j.StackEvents ?? [];
    return events
      .filter((e) => typeof e.ResourceStatus === 'string' && e.ResourceStatus.endsWith('_FAILED'))
      .slice(0, limit)
      .map((e) => ({
        logicalId: e.LogicalResourceId ?? '(不明)',
        status: e.ResourceStatus ?? '',
        reason: redact(e.ResourceStatusReason ?? ''),
      }));
  }
}
