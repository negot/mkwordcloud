// 各ステップの開始、終了、結果、所要時間の表示(NFR3.1、NFR3.4)。
// 合計が 15 分を超えたら「目安を超えた」と表示する。失敗にはしない。

export const TIME_BUDGET_MS = 15 * 60 * 1000;

export interface StepTimerDeps {
  now: () => number;
  out: (line: string) => void;
}

export interface StepRecord {
  name: string;
  result: string;
  durationMs: number;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

export class StepTimer {
  private readonly startedAt: number;
  private readonly records: StepRecord[] = [];

  constructor(private readonly deps: StepTimerDeps) {
    this.startedAt = deps.now();
  }

  /** ステップを始める。戻り値の関数を呼ぶと終了し、結果と所要時間を表示する。 */
  begin(name: string): (result: string) => void {
    const t0 = this.deps.now();
    this.deps.out(`▶ ${name} を開始`);
    return (result: string) => {
      const durationMs = this.deps.now() - t0;
      this.records.push({ name, result, durationMs });
      this.deps.out(`■ ${name}: ${result}(${formatDuration(durationMs)})`);
    };
  }

  get steps(): readonly StepRecord[] {
    return this.records;
  }

  totalMs(): number {
    return this.deps.now() - this.startedAt;
  }

  /** 合計時間を表示する。目安(15 分)を超えたときは、その旨を表示する。 */
  finish(): { totalMs: number; exceeded: boolean } {
    const totalMs = this.totalMs();
    const exceeded = totalMs > TIME_BUDGET_MS;
    this.deps.out(`合計 ${formatDuration(totalMs)}`);
    if (exceeded) {
      this.deps.out('目安の 15 分を超えました。(失敗ではありません。記録のために表示しています)');
    }
    return { totalMs, exceeded };
  }
}
