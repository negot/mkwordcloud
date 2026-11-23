// PostDeployChecker(FR5.1、FR5.2、NFR2.6、NFR3.6)。読み取り(GET)だけを行い、データは送信しない。
// 1 回 10 秒のタイムアウト、30 秒おきに最大 5 回の再試行。
import { readFileSync } from 'node:fs';

/** 存在しない部屋コード(形式は正しい 8 文字)。GET して 404 を確認する。 */
export const MISSING_ROOM_CODE = 'AAAAAAAA';

export interface PostDeployOutputs {
  webUrl: string;
  apiUrl: string;
}

export interface CheckItem {
  name: string;
  ok: boolean;
  attempts: number;
  detail: string;
}

export interface PostCheckResult {
  ok: boolean;
  items: CheckItem[];
  /** 全項目の試行回数の合計(記録用)。 */
  attemptsTotal: number;
}

export interface PostCheckDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  timeoutMs?: number;
  intervalMs?: number;
  maxRetries?: number;
}

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

/** cdk-outputs.json から WebUrl と ApiUrl を読む。読めないときは理由つきの例外。 */
export function readOutputs(file: string, readText: (p: string) => string = (p) => readFileSync(p, 'utf8')): PostDeployOutputs {
  let all: Record<string, Record<string, unknown>>;
  try {
    all = JSON.parse(readText(file));
  } catch (e) {
    throw new Error(`出力ファイルを読めません: ${file}(${e instanceof Error ? e.message : String(e)})`);
  }
  const o = all.WordcloudStack ?? Object.values(all)[0];
  if (!o || !isHttpsUrl(o.WebUrl) || !isHttpsUrl(o.ApiUrl)) {
    throw new Error('出力に有効な WebUrl または ApiUrl(https)がありません');
  }
  return { webUrl: o.WebUrl, apiUrl: o.ApiUrl };
}

async function attempt(
  deps: PostCheckDeps,
  url: string,
  expected: number,
): Promise<{ ok: boolean; detail: string }> {
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // GET のみ。本文もヘッダーも送らない(NFR2.6)。
    const res = await deps.fetch(url, { method: 'GET', signal: ctrl.signal });
    return res.status === expected
      ? { ok: true, detail: `HTTP ${res.status}` }
      : { ok: false, detail: `HTTP ${res.status}(期待: ${expected})` };
  } catch (e) {
    const aborted = ctrl.signal.aborted;
    return { ok: false, detail: aborted ? `${timeoutMs / 1000} 秒でタイムアウト` : `接続できません: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

async function checkWithRetry(deps: PostCheckDeps, name: string, url: string, expected: number): Promise<CheckItem> {
  const maxRetries = deps.maxRetries ?? 5;
  const interval = deps.intervalMs ?? 30_000;
  let last = { ok: false, detail: '' };
  let attempts = 0;
  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) await deps.sleep(interval);
    attempts++;
    last = await attempt(deps, url, expected);
    if (last.ok) break;
  }
  return { name, ok: last.ok, attempts, detail: last.detail };
}

export async function runPostCheck(outputs: PostDeployOutputs, deps: PostCheckDeps): Promise<PostCheckResult> {
  const api = outputs.apiUrl.replace(/\/+$/, '');
  const items = [
    await checkWithRetry(deps, 'HTTP API(存在しない部屋は 404)', `${api}/rooms/${MISSING_ROOM_CODE}`, 404),
    await checkWithRetry(deps, '表示用 Web(開ける)', outputs.webUrl, 200),
  ];
  return { ok: items.every((i) => i.ok), items, attemptsTotal: items.reduce((n, i) => n + i.attempts, 0) };
}
