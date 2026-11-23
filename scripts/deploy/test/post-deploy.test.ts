// PostDeployChecker のテスト(FR5.1、FR5.2、NFR2.6、NFR3.6)
import { describe, expect, it, vi } from 'vitest';
import { MISSING_ROOM_CODE, readOutputs, runPostCheck } from '../src/post-deploy.js';

const outputs = { webUrl: 'https://d1.cloudfront.net', apiUrl: 'https://abc.execute-api.ap-northeast-1.amazonaws.com/' };

function res(status: number): Response {
  return { status } as Response;
}

function deps(handler: (url: string, n: number) => Promise<Response> | Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const sleeps: number[] = [];
  const counts = new Map<string, number>();
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const n = (counts.get(url) ?? 0) + 1;
    counts.set(url, n);
    return handler(url, n);
  }) as typeof fetch;
  return { calls, sleeps, d: { fetch: fetchFn, sleep: async (ms: number) => void sleeps.push(ms) } };
}

describe('PostDeployChecker', () => {
  it('存在しない部屋で 404、表示用 Web で 200 なら成功する', async () => {
    const { d, calls } = deps((url) => res(url.includes('/rooms/') ? 404 : 200));
    const r = await runPostCheck(outputs, d);
    expect(r.ok).toBe(true);
    expect(r.attemptsTotal).toBe(2);
    expect(calls[0].url).toBe(`https://abc.execute-api.ap-northeast-1.amazonaws.com/rooms/${MISSING_ROOM_CODE}`);
    expect(calls[1].url).toBe('https://d1.cloudfront.net');
  });

  it('GET だけを送り、本文を送らない(読み取りだけ)', async () => {
    const { d, calls } = deps((url) => res(url.includes('/rooms/') ? 404 : 200));
    await runPostCheck(outputs, d);
    for (const c of calls) {
      expect(c.init?.method).toBe('GET');
      expect(c.init?.body).toBeUndefined();
    }
  });

  it('再試行して成功する(30 秒おき)', async () => {
    const { d, sleeps } = deps((url, n) => (url.includes('/rooms/') ? (n < 3 ? res(503) : res(404)) : res(200)));
    const r = await runPostCheck(outputs, d);
    expect(r.ok).toBe(true);
    expect(r.items[0].attempts).toBe(3);
    expect(sleeps).toEqual([30_000, 30_000]);
  });

  it('再試行を使い切って失敗する(最初の 1 回と再試行 5 回)', async () => {
    const { d, sleeps } = deps((url) => (url.includes('/rooms/') ? res(500) : res(200)));
    const r = await runPostCheck(outputs, d);
    expect(r.ok).toBe(false);
    expect(r.items[0]).toMatchObject({ ok: false, attempts: 6 });
    expect(r.items[0].detail).toContain('500');
    expect(sleeps).toHaveLength(5);
    expect(r.items[1].ok).toBe(true);
  });

  it('タイムアウトを失敗として扱う', async () => {
    const fetchFn = ((_u: string, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
      })) as unknown as typeof fetch;
    const r = await runPostCheck(outputs, { fetch: fetchFn, sleep: async () => {}, timeoutMs: 20, maxRetries: 1 });
    expect(r.ok).toBe(false);
    expect(r.items[0].detail).toContain('タイムアウト');
    expect(r.items[0].attempts).toBe(2);
  });

  it('接続できないときの詳細', async () => {
    const { d } = deps(() => {
      throw new Error('ECONNREFUSED');
    });
    const r = await runPostCheck(outputs, { ...d, maxRetries: 0 });
    expect(r.items[0].detail).toContain('ECONNREFUSED');
  });

  it('fake timer でも待ち時間を進めて完了する', async () => {
    vi.useFakeTimers();
    try {
      const { d } = deps((url, n) => (url.includes('/rooms/') ? (n < 2 ? res(404 + 100) : res(404)) : res(200)));
      const p = runPostCheck(outputs, { ...d, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
      await vi.advanceTimersByTimeAsync(30_000);
      expect((await p).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('readOutputs', () => {
  const reader = (text: string) => () => text;

  it('WordcloudStack の WebUrl と ApiUrl を読む', () => {
    const text = JSON.stringify({ WordcloudStack: { WebUrl: 'https://w.example', ApiUrl: 'https://a.example' } });
    expect(readOutputs('x.json', reader(text))).toEqual({ webUrl: 'https://w.example', apiUrl: 'https://a.example' });
  });

  it('スタック名が違っても最初のエントリを使う', () => {
    const text = JSON.stringify({ Other: { WebUrl: 'https://w.example', ApiUrl: 'https://a.example' } });
    expect(readOutputs('x.json', reader(text)).webUrl).toBe('https://w.example');
  });

  it('出力ファイルがなければ理由つきで失敗する', () => {
    expect(() => readOutputs('/no/such/cdk-outputs.json')).toThrow('出力ファイルを読めません');
  });

  it('URL がない、または https でないときは失敗する', () => {
    expect(() => readOutputs('x', reader('{"WordcloudStack":{"WebUrl":"https://w"}}'))).toThrow('WebUrl');
    expect(() => readOutputs('x', reader('{"WordcloudStack":{"WebUrl":"http://w.example","ApiUrl":"https://a.example"}}'))).toThrow('https');
    expect(() => readOutputs('x', reader('{}'))).toThrow();
    expect(() => readOutputs('x', reader('not json'))).toThrow('読めません');
  });
});
