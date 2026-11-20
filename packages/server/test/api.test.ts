import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startLocalServer, type LocalServer } from '../src/local.js';
import { handleRest } from '../src/service.js';
import { EXT_ORIGIN, ORIGIN, makeDeps, stubTokenize } from './helpers.js';

describe('REST の経路と CORS (NFR2.6)', () => {
  it('POST /rooms でルームを作成でき、GET /rooms/{code} で存在を確認できる', async () => {
    const { deps } = makeDeps();
    const created = await handleRest({ method: 'POST', path: '/rooms', headers: { Origin: ORIGIN }, body: '' }, deps);
    expect(created.status).toBe(201);
    const { roomCode, hostKey } = JSON.parse(created.body);
    expect(roomCode).toHaveLength(8);
    expect(hostKey.length).toBeGreaterThanOrEqual(32);
    expect(created.headers['access-control-allow-origin']).toBe(ORIGIN);

    const ok = await handleRest({ method: 'GET', path: `/rooms/${roomCode.toLowerCase()}`, headers: { origin: EXT_ORIGIN } }, deps);
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body)).toEqual({ exists: true });
    const none = await handleRest({ method: 'GET', path: '/rooms/ZZZZZZZZ', headers: {} }, deps);
    expect(none.status).toBe(404);
  });

  it('許可されないOriginは403で、CORSヘッダーを返さない', async () => {
    const { deps } = makeDeps();
    const r = await handleRest({ method: 'POST', path: '/rooms', headers: { origin: 'https://evil.example' } }, deps);
    expect(r.status).toBe(403);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('OPTIONS は204で、許可Originだけを反映する', async () => {
    const { deps } = makeDeps();
    const r = await handleRest({ method: 'OPTIONS', path: '/rooms', headers: { origin: EXT_ORIGIN } }, deps);
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe(EXT_ORIGIN);
    expect(r.headers['access-control-allow-headers']).toContain('x-host-key');
  });

  it('本文が2KBを超えると413、未知の経路は404', async () => {
    const { deps } = makeDeps();
    const big = await handleRest({ method: 'POST', path: '/rooms', headers: {}, body: JSON.stringify({ a: 'x'.repeat(3000) }) }, deps);
    expect(big.status).toBe(413);
    expect((await handleRest({ method: 'GET', path: '/nope', headers: {} }, deps)).status).toBe(404);
  });
});

describe('ローカルサーバーの往復 (NFR6.1, FR3.5)', () => {
  let server: LocalServer;
  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wc-web-'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>t</title>');
    server = await startLocalServer({ port: 0, webDir: dir, tokenize: stubTokenize });
  });
  afterAll(async () => {
    await server.close();
  });

  const open = (url: string, headers: Record<string, string> = {}) =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url, { headers });
      ws.once('open', () => resolve(ws));
      ws.once('unexpected-response', (_req, res) => reject(new Error(`status ${res.statusCode}`)));
      ws.once('error', reject);
    });
  const next = (ws: WebSocket, pred: (m: any) => boolean) =>
    new Promise<any>((resolve) => {
      const on = (d: Buffer) => {
        const m = JSON.parse(d.toString());
        if (pred(m)) {
          ws.off('message', on);
          resolve(m);
        }
      };
      ws.on('message', on);
    });

  it('/config.json と静的ファイルを返す', async () => {
    const cfg = await (await fetch(`${server.httpUrl}/config.json`)).json();
    expect(cfg).toEqual({ apiUrl: server.httpUrl, wsUrl: server.wsUrl });
    const html = await fetch(`${server.httpUrl}/`);
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('<title>');
  });

  it('参加者の投稿が表示側へ届き、許可されないOriginは拒否される', async () => {
    const created = await (await fetch(`${server.httpUrl}/rooms`, { method: 'POST' })).json();
    const room = created.roomCode as string;

    const viewer = await open(`${server.wsUrl}?room=${room}&role=viewer`);
    const snap = next(viewer, (m) => m.type === 'snapshot');
    viewer.send(JSON.stringify({ type: 'sync' }));
    expect((await snap).words).toEqual([]);

    const participant = await open(`${server.wsUrl}?room=${room}&role=participant&clientId=client-abcdef12`, {
      Origin: EXT_ORIGIN,
    });
    const update = next(viewer, (m) => m.type === 'update');
    const ack = next(participant, (m) => m.type === 'ack');
    participant.send(JSON.stringify({ type: 'submit', text: 'neko inu' }));
    expect((await update).words).toEqual(expect.arrayContaining([{ word: 'neko', count: 1 }]));
    await ack;

    await expect(
      open(`${server.wsUrl}?room=${room}&role=viewer`, { Origin: 'https://evil.example' }),
    ).rejects.toThrow(/403/);
    await expect(open(`${server.wsUrl}?room=ZZZZZZZZ&role=viewer`)).rejects.toThrow(/404/);
    viewer.close();
    participant.close();
  });
});
