// FailureReporter(FR6.2、NFR5.6、NFR5.7)。デプロイの失敗時に、スタックの状態と、
// 失敗したリソースとその理由を CloudFormation のイベントから取得して表示する。
import type { AwsCli, StackEvent } from './aws-cli.js';
import { STACK_NAME } from './preflight.js';

export interface FailureSummary {
  stackStatus: string | null;
  failedResources: StackEvent[];
  /** 取得に失敗したときの理由(表示用)。 */
  error?: string;
  /** UPDATE_ROLLBACK_FAILED のときの案内が必要か。 */
  needsManualRecovery: boolean;
}

export async function reportFailure(opts: {
  aws: AwsCli;
  region: string;
  out: (line: string) => void;
}): Promise<FailureSummary> {
  const { aws, region, out } = opts;
  out('--- デプロイの失敗の報告 ---');
  let stackStatus: string | null = null;
  let failedResources: StackEvent[] = [];
  let error: string | undefined;
  try {
    [stackStatus, failedResources] = await Promise.all([
      aws.stackStatus(STACK_NAME, region),
      aws.failedEvents(STACK_NAME, region),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    out(`スタックの状態を取得できませんでした: ${error}`);
    out('AWS コンソールの CloudFormation で、スタックのイベントを確認してください。');
  } else {
    out(`スタックの状態: ${stackStatus ?? '(スタックなし)'}`);
    if (failedResources.length === 0) out('失敗したリソースのイベントは見つかりませんでした。');
    for (const f of failedResources) out(`失敗: ${f.logicalId} ${f.status} ${f.reason}`);
  }
  const needsManualRecovery = stackStatus === 'UPDATE_ROLLBACK_FAILED';
  if (needsManualRecovery) {
    out('ロールバックが詰まっています。手作業で復旧してください(docs/deploy.md の「ロールバックが詰まったとき」)。');
  }
  return { stackStatus, failedResources, error, needsManualRecovery };
}
