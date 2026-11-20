import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ROOM_TTL_SECONDS } from '@wordcloud/core';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { DynamoRepository } from '../src/dynamo-repository.js';
import { MemoryRepository } from '../src/memory-repository.js';

describe('MemoryRepository (FR1.5, FR3.7, NFR3.2)', () => {
  let now = 1_700_000_000_000;
  let repo: MemoryRepository;
  beforeEach(() => {
    now = 1_700_000_000_000;
    repo = new MemoryRepository(() => now);
  });

  it('ルームを作成して取得でき、TTL は24時間後になる', async () => {
    const meta = await repo.createRoom('ABCD2345', 'hash');
    expect(meta?.ttl).toBe(Math.floor(now / 1000) + ROOM_TTL_SECONDS);
    expect((await repo.getRoom('ABCD2345'))?.hostKeyHash).toBe('hash');
    expect(await repo.createRoom('ABCD2345', 'other')).toBeNull();
    expect(await repo.getRoom('ZZZZZZZZ')).toBeNull();
  });

  it('TTL を過ぎたルームは存在しない扱いになる', async () => {
    await repo.createRoom('ABCD2345', 'hash');
    now += (ROOM_TTL_SECONDS + 1) * 1000;
    expect(await repo.getRoom('ABCD2345')).toBeNull();
  });

  it('語の出現回数を加算し、count降順で取得できる', async () => {
    const ttl = Math.floor(now / 1000) + 1000;
    await repo.incrementWords('R', ['猫', 'dog'], ttl);
    const updated = await repo.incrementWords('R', ['猫'], ttl);
    expect(updated).toEqual([{ word: '猫', count: 2 }]);
    expect(await repo.getWords('R')).toEqual([
      { word: '猫', count: 2 },
      { word: 'dog', count: 1 },
    ]);
  });

  it('リセットで語だけ消え、削除でルームごと消える', async () => {
    await repo.createRoom('R', 'h');
    await repo.incrementWords('R', ['a1'], Math.floor(now / 1000) + 100);
    await repo.resetWords('R');
    expect(await repo.getWords('R')).toEqual([]);
    expect(await repo.getRoom('R')).not.toBeNull();
    await repo.incrementWords('R', ['a1'], Math.floor(now / 1000) + 100);
    await repo.deleteRoom('R');
    expect(await repo.getRoom('R')).toBeNull();
    expect(await repo.getWords('R')).toEqual([]);
  });

  it('接続の登録・取得・削除と、表示側の一覧', async () => {
    const ttl = Math.floor(now / 1000) + 100;
    await repo.addConnection({ connId: 'c1', room: 'R', role: 'viewer', clientId: 'x' }, ttl);
    await repo.addConnection({ connId: 'c2', room: 'R', role: 'participant', clientId: 'y' }, ttl);
    expect(await repo.listViewers('R')).toEqual(['c1']);
    expect((await repo.getConnection('c2'))?.role).toBe('participant');
    await repo.removeConnection('c1');
    expect(await repo.listViewers('R')).toEqual([]);
    expect(await repo.getConnection('c1')).toBeNull();
  });

  it('レート状態を保存して取得できる', async () => {
    const s = { lastAt: 5, windowStart: 1, windowCount: 2 };
    await repo.putRate('R', 'c', s);
    expect(await repo.getRate('R', 'c')).toEqual(s);
    expect(await repo.getRate('R', 'zzz')).toBeUndefined();
  });
});

describe('DynamoRepository (aws-sdk-client-mock)', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  const now = 1_700_000_000_000;
  const nowSec = Math.floor(now / 1000);
  let repo: DynamoRepository;
  beforeEach(() => {
    ddbMock.reset();
    repo = new DynamoRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
      'wordcloud',
      () => now,
    );
  });

  it('createRoom は ttl 付きで、既存でなければ書き込む', async () => {
    ddbMock.on(PutCommand).resolves({});
    const meta = await repo.createRoom('ABCD2345', 'hash');
    expect(meta?.ttl).toBe(nowSec + ROOM_TTL_SECONDS);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.Item).toMatchObject({ pk: 'ROOM#ABCD2345', sk: 'META', hostKeyHash: 'hash', ttl: nowSec + ROOM_TTL_SECONDS });
    expect(input.ConditionExpression).toContain('attribute_not_exists(pk)');
  });

  it('createRoom は既存コードなら null を返す', async () => {
    ddbMock.on(PutCommand).rejects(Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }));
    expect(await repo.createRoom('ABCD2345', 'h')).toBeNull();
  });

  it('getRoom は期限切れ(TTL遅延)を存在しない扱いにする', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { pk: 'ROOM#R', sk: 'META', hostKeyHash: 'h', createdAt: 1, ttl: nowSec - 10 } });
    expect(await repo.getRoom('R')).toBeNull();
  });

  it('incrementWords は ADD で加算し、更新後の値を返す', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 3 } });
    const r = await repo.incrementWords('R', ['猫'], nowSec + 50);
    expect(r).toEqual([{ word: '猫', count: 3 }]);
    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.Key).toEqual({ pk: 'ROOM#R', sk: 'WORD#猫' });
    expect(input.UpdateExpression).toContain('ADD #c :one');
    expect(input.ReturnValues).toBe('ALL_NEW');
    expect(input.ExpressionAttributeValues?.[':ttl']).toBe(nowSec + 50);
  });

  it('deleteRoom は Query で全キーを集めて BatchWrite で削除する', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { pk: 'ROOM#R', sk: 'META' },
        { pk: 'ROOM#R', sk: 'WORD#a1' },
      ],
    });
    ddbMock.on(BatchWriteCommand).resolves({});
    await repo.deleteRoom('R');
    const batch = ddbMock.commandCalls(BatchWriteCommand)[0].args[0].input;
    expect(batch.RequestItems?.wordcloud).toHaveLength(2);
    expect(batch.RequestItems?.wordcloud[0].DeleteRequest?.Key).toEqual({ pk: 'ROOM#R', sk: 'META' });
  });

  it('getWords は WORD# を問い合わせて count 降順で返す', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { pk: 'ROOM#R', sk: 'WORD#a1', count: 1 },
        { pk: 'ROOM#R', sk: 'WORD#猫', count: 4 },
      ],
    });
    expect(await repo.getWords('R')).toEqual([
      { word: '猫', count: 4 },
      { word: 'a1', count: 1 },
    ]);
  });

  it('viewer の接続は CONN と VIEWER の両方に ttl 付きで保存される', async () => {
    ddbMock.on(PutCommand).resolves({});
    await repo.addConnection({ connId: 'c1', room: 'R', role: 'viewer', clientId: 'x' }, nowSec + 9);
    const items = ddbMock.commandCalls(PutCommand).map((c) => c.args[0].input.Item);
    expect(items).toContainEqual(expect.objectContaining({ pk: 'CONN#c1', ttl: nowSec + 9 }));
    expect(items).toContainEqual(expect.objectContaining({ pk: 'ROOM#R', sk: 'VIEWER#c1', ttl: nowSec + 9 }));
  });
});
