// リスク検出(FR3.6、FR2.3、NFR5.4)。cdk diff の出力から、データ消失のおそれのある変更と、
// スケーリング設定の変更を検出する。検出は警告のみで、止めるのは承認の段階である。

export interface DataLossRisk {
  resourceType: 'AWS::DynamoDB::Table' | 'AWS::S3::Bucket';
  logicalId: string;
  action: 'replace' | 'delete';
}

export interface ScalingChange {
  logicalId: string;
  line: string;
}

export interface RiskReport {
  dataLoss: DataLossRisk[];
  scaling: ScalingChange[];
}

const DATA_TYPES = new Set(['AWS::DynamoDB::Table', 'AWS::DynamoDB::GlobalTable', 'AWS::S3::Bucket']);
// 課金モード、同時実行の予約、スロットル値。
const SCALING_PROPS = /(BillingMode|ReservedConcurrentExecutions|ThrottlingBurstLimit|ThrottlingRateLimit|ProvisionedThroughput)/;
const ANSI = /\x1b\[[0-9;]*m/g;
const RESOURCE_LINE = /^\s*\[([+\-~])\]\s+(AWS::[A-Za-z0-9:]+)\s+(\S+)(?:\s+(\S+))?(?:\s+(.*))?$/;

export function detectRisks(diffText: string): RiskReport {
  const dataLoss: DataLossRisk[] = [];
  const scaling: ScalingChange[] = [];
  const seen = new Set<string>();
  let current: { type: string; id: string; op: string } | null = null;

  const addLoss = (type: string, id: string, action: 'replace' | 'delete') => {
    const key = `${type}|${id}|${action}`;
    if (seen.has(key) || !DATA_TYPES.has(type)) return;
    seen.add(key);
    dataLoss.push({ resourceType: type as DataLossRisk['resourceType'], logicalId: id, action });
  };

  for (const raw of diffText.replace(ANSI, '').split('\n')) {
    const m = RESOURCE_LINE.exec(raw);
    if (m) {
      const [, op, type, name, , rest = ''] = m;
      current = { type, id: name, op };
      if (op === '-') addLoss(type, name, 'delete');
      else if (op === '~' && /replace/i.test(rest)) addLoss(type, name, 'replace');
      continue;
    }
    if (current && current.op === '~' && /requires replacement/i.test(raw)) {
      addLoss(current.type, current.id, 'replace');
    }
    if (current && /\[[+\-~]\]/.test(raw) && SCALING_PROPS.test(raw)) {
      scaling.push({ logicalId: current.id, line: raw.trim() });
    }
  }
  return { dataLoss, scaling };
}

/** 画面に出す警告(データ消失のおそれ、スケーリング設定の変更)。なければ空。 */
export function describeRisks(report: RiskReport): string[] {
  const lines: string[] = [];
  for (const r of report.dataLoss) {
    const what = r.action === 'replace' ? '置換(データが消えるおそれ)' : '削除(データが消える)';
    lines.push(`⚠ データ消失のおそれ: ${r.resourceType} ${r.logicalId} が ${what}`);
  }
  for (const s of report.scaling) {
    lines.push(`⚠ スケーリング設定の変更: ${s.logicalId}: ${s.line}`);
  }
  return lines;
}
