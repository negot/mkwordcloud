import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ROOM_TTL_SECONDS, type RateState } from '@wordcloud/core';
import {
  RATE_TTL_SECONDS,
  sortWords,
  type ConnectionInfo,
  type Repository,
  type RoomMeta,
  type WordCount,
} from './repository.js';

type Key = { pk: string; sk: string };

const roomPk = (code: string) => `ROOM#${code}`;
const META = 'META';

/**
 * DynamoDB 単一テーブル実装。キー設計:
 * - ROOM#<code> / META, WORD#<word>, VIEWER#<connId>
 * - CONN#<connId> / META
 * - RATE#<room>#<clientId> / META
 * DynamoDB の TTL による削除は遅れることがあるため、読み取り時にも ttl を確認する。
 */
export class DynamoRepository implements Repository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly clock: () => number = Date.now,
  ) {}

  private nowSec(): number {
    return Math.floor(this.clock() / 1000);
  }

  async createRoom(code: string, hostKeyHash: string): Promise<RoomMeta | null> {
    const createdAt = this.clock();
    const ttl = this.nowSec() + ROOM_TTL_SECONDS;
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: roomPk(code), sk: META, hostKeyHash, createdAt, ttl },
          ConditionExpression: 'attribute_not_exists(pk) OR #t < :now',
          ExpressionAttributeNames: { '#t': 'ttl' },
          ExpressionAttributeValues: { ':now': this.nowSec() },
        }),
      );
    } catch (e) {
      if ((e as { name?: string }).name === 'ConditionalCheckFailedException') return null;
      throw e;
    }
    return { code, hostKeyHash, createdAt, ttl };
  }

  async getRoom(code: string): Promise<RoomMeta | null> {
    const r = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: roomPk(code), sk: META } }),
    );
    const item = r.Item;
    if (!item || typeof item.ttl !== 'number' || item.ttl <= this.nowSec()) return null;
    return { code, hostKeyHash: item.hostKeyHash, createdAt: item.createdAt, ttl: item.ttl };
  }

  /** pk 配下の(任意で sk の接頭辞が一致する)キーを全て集める。 */
  private async queryKeys(pk: string, skPrefix?: string): Promise<Key[]> {
    const keys: Key[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: skPrefix ? 'pk = :pk AND begins_with(sk, :p)' : 'pk = :pk',
          ExpressionAttributeValues: skPrefix ? { ':pk': pk, ':p': skPrefix } : { ':pk': pk },
          ProjectionExpression: 'pk, sk',
          ExclusiveStartKey: start,
        }),
      );
      for (const i of r.Items ?? []) keys.push({ pk: i.pk, sk: i.sk });
      start = r.LastEvaluatedKey;
    } while (start);
    return keys;
  }

  private async batchDelete(keys: Key[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 25) {
      let pending: Key[] = keys.slice(i, i + 25);
      for (let attempt = 0; pending.length > 0 && attempt < 5; attempt++) {
        const r = await this.doc.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: pending.map((Key) => ({ DeleteRequest: { Key } })),
            },
          }),
        );
        const un = r.UnprocessedItems?.[this.tableName] ?? [];
        pending = un.map((u) => u.DeleteRequest!.Key as Key);
      }
      if (pending.length > 0) throw new Error('削除を完了できませんでした');
    }
  }

  async deleteRoom(code: string): Promise<void> {
    await this.batchDelete(await this.queryKeys(roomPk(code)));
  }

  async resetWords(code: string): Promise<void> {
    await this.batchDelete(await this.queryKeys(roomPk(code), 'WORD#'));
  }

  async incrementWords(code: string, words: string[], ttl: number): Promise<WordCount[]> {
    return Promise.all(
      words.map(async (word) => {
        const r = await this.doc.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { pk: roomPk(code), sk: `WORD#${word}` },
            UpdateExpression: 'ADD #c :one SET #t = :ttl',
            ExpressionAttributeNames: { '#c': 'count', '#t': 'ttl' },
            ExpressionAttributeValues: { ':one': 1, ':ttl': ttl },
            ReturnValues: 'ALL_NEW',
          }),
        );
        return { word, count: Number(r.Attributes?.count ?? 1) };
      }),
    );
  }

  async getWords(code: string): Promise<WordCount[]> {
    const out: WordCount[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
          ExpressionAttributeValues: { ':pk': roomPk(code), ':p': 'WORD#' },
          ExclusiveStartKey: start,
        }),
      );
      for (const i of r.Items ?? []) {
        out.push({ word: String(i.sk).slice('WORD#'.length), count: Number(i.count) });
      }
      start = r.LastEvaluatedKey;
    } while (start);
    return sortWords(out);
  }

  async addConnection(conn: ConnectionInfo, ttl: number): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `CONN#${conn.connId}`,
          sk: META,
          room: conn.room,
          role: conn.role,
          clientId: conn.clientId,
          ttl,
        },
      }),
    );
    if (conn.role === 'viewer') {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: roomPk(conn.room), sk: `VIEWER#${conn.connId}`, ttl },
        }),
      );
    }
  }

  async getConnection(connId: string): Promise<ConnectionInfo | null> {
    const r = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `CONN#${connId}`, sk: META } }),
    );
    const i = r.Item;
    if (!i || i.ttl <= this.nowSec()) return null;
    return { connId, room: i.room, role: i.role, clientId: i.clientId };
  }

  async removeConnection(connId: string): Promise<void> {
    const conn = await this.getConnection(connId);
    await this.doc.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: `CONN#${connId}`, sk: META } }),
    );
    if (conn?.role === 'viewer') {
      await this.doc.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: roomPk(conn.room), sk: `VIEWER#${connId}` },
        }),
      );
    }
  }

  async listViewers(room: string): Promise<string[]> {
    const keys = await this.queryKeys(roomPk(room), 'VIEWER#');
    return keys.map((k) => k.sk.slice('VIEWER#'.length));
  }

  async getRate(room: string, clientId: string): Promise<RateState | undefined> {
    const r = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `RATE#${room}#${clientId}`, sk: META },
      }),
    );
    const i = r.Item;
    if (!i || i.ttl <= this.nowSec()) return undefined;
    return { lastAt: i.lastAt, windowStart: i.windowStart, windowCount: i.windowCount };
  }

  async putRate(room: string, clientId: string, state: RateState): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `RATE#${room}#${clientId}`,
          sk: META,
          lastAt: state.lastAt,
          windowStart: state.windowStart,
          windowCount: state.windowCount,
          ttl: this.nowSec() + RATE_TTL_SECONDS,
        },
      }),
    );
  }
}
