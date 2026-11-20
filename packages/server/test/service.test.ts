import { describe, expect, it } from 'vitest';
import { EMPTY_RATE_STATE } from '@wordcloud/core';
import { handleRest, handleWsConnect, handleWsDisconnect, handleWsMessage } from '../src/service.js';
import { ORIGIN, makeDeps } from './helpers.js';

async function setup() {
  const ctx = makeDeps();
  const res = await handleRest({ method: 'POST', path: '/rooms', headers: { origin: ORIGIN }, body: '' }, ctx.deps);
  const { roomCode, hostKey } = JSON.parse(res.body) as { roomCode: string; hostKey: string };
  return { ...ctx, roomCode, hostKey };
}

async function connect(ctx: Awaited<ReturnType<typeof setup>>, connId: string, role: 'participant' | 'viewer', clientId = 'client-' + connId + '-0000') {
  return handleWsConnect(
    { connId, query: { room: ctx.roomCode, role, clientId }, headers: { origin: ORIGIN } },
    ctx.deps,
  );
}

const submit = (text: string) => JSON.stringify({ type: 'submit', text });

describe('ルーム参加 (FR2.2, NFR2.2, NFR2.6)', () => {
  it('存在しないルームへの参加は拒否される', async () => {
    const { deps } = makeDeps();
    const r = await handleWsConnect(
      { connId: 'c1', query: { room: 'ABCD2345', role: 'participant', clientId: 'client-0000' }, headers: {} },
      deps,
    );
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it('許可されないOriginのWebSocket接続は拒否される', async () => {
    const ctx = await setup();
    const r = await handleWsConnect(
      { connId: 'c1', query: { room: ctx.roomCode, role: 'viewer' }, headers: { Origin: 'https://evil.example' } },
      ctx.deps,
    );
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it('正しいルームコードなら参加でき、役割が不正なら拒否される', async () => {
    const ctx = await setup();
    expect(await connect(ctx, 'c1', 'participant')).toEqual({ ok: true });
    const bad = await handleWsConnect(
      { connId: 'c2', query: { room: ctx.roomCode, role: 'admin' }, headers: {} },
      ctx.deps,
    );
    expect(bad).toMatchObject({ ok: false, status: 400 });
  });
});

describe('投稿の集計と配信 (FR3.1, FR3.5, FR3.6, FR3.7)', () => {
  it('参加者の投稿が集計され、表示側へ update が届き、送信者に ack が返る', async () => {
    const ctx = await setup();
    await connect(ctx, 'v1', 'viewer');
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('Cat dog') }, ctx.deps);
    const update = ctx.pusher.to('v1').find((m) => m.type === 'update');
    expect(update).toEqual({
      type: 'update',
      words: expect.arrayContaining([
        { word: 'cat', count: 1 },
        { word: 'dog', count: 1 },
      ]),
    });
    expect(ctx.pusher.to('p1')).toContainEqual({ type: 'ack' });
  });

  it('表示側は sync で現在の集計全体(snapshot)を受け取れる', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('hello') }, ctx.deps);
    ctx.clock.t += 2000;
    await handleWsMessage({ connId: 'p1', body: submit('hello world') }, ctx.deps);
    await connect(ctx, 'v1', 'viewer');
    await handleWsMessage({ connId: 'v1', body: JSON.stringify({ type: 'sync' }) }, ctx.deps);
    expect(ctx.pusher.to('v1')).toContainEqual({
      type: 'snapshot',
      words: [
        { word: 'hello', count: 2 },
        { word: 'world', count: 1 },
      ],
    });
  });

  it('入力テキストそのものは保存されず、語の回数だけが残る', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    const text = 'secret phrase here';
    await handleWsMessage({ connId: 'p1', body: submit(text) }, ctx.deps);
    const words = await ctx.deps.repo.getWords(ctx.roomCode);
    expect(words.map((w) => w.word).sort()).toEqual(['here', 'phrase', 'secret']);
    expect(JSON.stringify([...words])).not.toContain(text);
  });

  it('切断済みの表示側は登録から外される', async () => {
    const ctx = await setup();
    await connect(ctx, 'v1', 'viewer');
    await connect(ctx, 'p1', 'participant');
    ctx.pusher.gone.add('v1');
    await handleWsMessage({ connId: 'p1', body: submit('x1') }, ctx.deps);
    expect(await ctx.deps.repo.listViewers(ctx.roomCode)).toEqual([]);
    await handleWsDisconnect({ connId: 'p1' }, ctx.deps);
    expect(await ctx.deps.repo.getConnection('p1')).toBeNull();
  });
});

describe('送信の拒否 (FR2.4, NFR2.4, NFR2.5)', () => {
  it('100文字は受理され、101文字は too_long', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('a'.repeat(100)) }, ctx.deps);
    expect(ctx.pusher.to('p1')).toContainEqual({ type: 'ack' });
    ctx.clock.t += 2000;
    await handleWsMessage({ connId: 'p1', body: submit('a'.repeat(101)) }, ctx.deps);
    expect(ctx.pusher.to('p1')).toContainEqual(expect.objectContaining({ type: 'error', code: 'too_long' }));
  });

  it('1秒以内の2回目は too_fast、1分に20回を超えると too_many', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('one') }, ctx.deps);
    ctx.clock.t += 500;
    await handleWsMessage({ connId: 'p1', body: submit('two') }, ctx.deps);
    expect(ctx.pusher.to('p1')).toContainEqual(expect.objectContaining({ code: 'too_fast' }));
    for (let i = 0; i < 25; i++) {
      ctx.clock.t += 1000;
      await handleWsMessage({ connId: 'p1', body: submit('w' + i) }, ctx.deps);
    }
    expect(ctx.pusher.to('p1')).toContainEqual(expect.objectContaining({ code: 'too_many' }));
  });

  it('clientId 側の記録が無くても、同じ接続は接続単位で制限される (NFR2.5)', async () => {
    const ctx = await setup();
    const clientId = 'client-p1-0000';
    await connect(ctx, 'p1', 'participant', clientId);
    await handleWsMessage({ connId: 'p1', body: submit('one') }, ctx.deps);
    // clientId 単位の記録を消しても(clientId に依存しなくても)、接続単位の記録が残っている
    await ctx.deps.repo.putRate(ctx.roomCode, clientId, EMPTY_RATE_STATE);
    ctx.clock.t += 500;
    await handleWsMessage({ connId: 'p1', body: submit('two') }, ctx.deps);
    expect(ctx.pusher.to('p1')).toContainEqual(expect.objectContaining({ code: 'too_fast' }));
    // 別の接続は影響を受けない
    await connect(ctx, 'p2', 'participant');
    await handleWsMessage({ connId: 'p2', body: submit('three') }, ctx.deps);
    expect(ctx.pusher.to('p2')).toContainEqual({ type: 'ack' });
  });

  it('不正なJSONや空の送信はエラーになり、日本語のメッセージが付く', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: '{oops' }, ctx.deps);
    await handleWsMessage({ connId: 'p1', body: submit('   ') }, ctx.deps);
    const errs = ctx.pusher.to('p1').filter((m) => m.type === 'error');
    expect(errs.map((e) => (e as { code: string }).code)).toEqual(['invalid_json', 'empty']);
    expect((errs[0] as { message: string }).message).toMatch(/形式/);
  });

  it('ルーム終了後の送信は no_room になる', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    await handleRest(
      { method: 'DELETE', path: `/rooms/${ctx.roomCode}`, headers: { 'x-host-key': ctx.hostKey } },
      ctx.deps,
    );
    await handleWsMessage({ connId: 'p1', body: submit('late') }, ctx.deps);
    expect(ctx.pusher.to('p1')).toContainEqual(expect.objectContaining({ code: 'no_room' }));
  });

  it('表示側からの送信は forbidden、ping には pong が返る', async () => {
    const ctx = await setup();
    await connect(ctx, 'v1', 'viewer');
    await handleWsMessage({ connId: 'v1', body: submit('x1') }, ctx.deps);
    await handleWsMessage({ connId: 'v1', body: JSON.stringify({ type: 'ping' }) }, ctx.deps);
    expect(ctx.pusher.to('v1')).toContainEqual(expect.objectContaining({ code: 'forbidden' }));
    expect(ctx.pusher.to('v1')).toContainEqual({ type: 'pong' });
  });
});

describe('主催者の操作 (FR1.3, FR1.4, FR1.6)', () => {
  it('誤った主催者キーではリセットが拒否され、集計は変わらない', async () => {
    const ctx = await setup();
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('keep') }, ctx.deps);
    for (const key of ['wrong', undefined]) {
      const r = await handleRest(
        { method: 'POST', path: `/rooms/${ctx.roomCode}/reset`, headers: key ? { 'x-host-key': key } : {} },
        ctx.deps,
      );
      expect(r.status).toBe(403);
    }
    expect(await ctx.deps.repo.getWords(ctx.roomCode)).toEqual([{ word: 'keep', count: 1 }]);
  });

  it('正しいキーでリセットすると集計が0になり、表示側へ空の snapshot が届く', async () => {
    const ctx = await setup();
    await connect(ctx, 'v1', 'viewer');
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('keep') }, ctx.deps);
    const r = await handleRest(
      { method: 'POST', path: `/rooms/${ctx.roomCode}/reset`, headers: { 'x-host-key': ctx.hostKey } },
      ctx.deps,
    );
    expect(r.status).toBe(200);
    expect(await ctx.deps.repo.getWords(ctx.roomCode)).toEqual([]);
    expect(ctx.pusher.to('v1').at(-1)).toEqual({ type: 'snapshot', words: [] });
  });

  it('終了するとルームの全データが消え、表示側へ ended が届く', async () => {
    const ctx = await setup();
    await connect(ctx, 'v1', 'viewer');
    await connect(ctx, 'p1', 'participant');
    await handleWsMessage({ connId: 'p1', body: submit('gone') }, ctx.deps);
    const r = await handleRest(
      { method: 'DELETE', path: `/rooms/${ctx.roomCode}`, headers: { 'x-host-key': ctx.hostKey } },
      ctx.deps,
    );
    expect(r.status).toBe(200);
    expect(await ctx.deps.repo.getRoom(ctx.roomCode)).toBeNull();
    expect(await ctx.deps.repo.getWords(ctx.roomCode)).toEqual([]);
    expect(ctx.pusher.to('v1').at(-1)).toEqual({ type: 'ended' });
  });
});
