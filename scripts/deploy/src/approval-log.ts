// 承認ログ(FR3.5、NFR1.4、NFR2.4、NFR2.5)。JSON Lines。1 行を 1 回の追記で書く。
// 書けないときは例外にせず失敗を返す(呼び出し元がフェイルクローズする)。
// 秘密情報と入力テキストは書かない: 行は書く前に伏せ字を通す。
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { redact } from './redact.js';

export const LOG_KINDS = ['abort', 'start', 'approval', 'deploy', 'postcheck', 'humancheck', 'end'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export type LogResult = { ok: true } | { ok: false; error: string };

export interface ApprovalLogDeps {
  now: () => Date;
}

export class ApprovalLog {
  constructor(
    readonly path: string,
    readonly attemptId: string,
    private readonly deps: ApprovalLogDeps = { now: () => new Date() },
  ) {}

  /** 1 行を追記する。日時(UTC)、attemptId、種類は自動で付く。 */
  append(kind: LogKind, fields: Record<string, unknown> = {}): LogResult {
    try {
      const row = { ts: this.deps.now().toISOString(), attemptId: this.attemptId, kind, ...fields };
      const line = redact(JSON.stringify(row)) + '\n';
      mkdirSync(dirname(this.path), { recursive: true });
      // 1 回の追記(O_APPEND)。上書きしない。
      appendFileSync(this.path, line, { encoding: 'utf8', flag: 'a' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

/** attemptId: 日時(UTC)とコミットのハッシュから作る(observability-design.md「相関」)。 */
export function makeAttemptId(now: Date, commit: string | undefined): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${commit ? commit.slice(0, 12) : 'nocommit'}`;
}
