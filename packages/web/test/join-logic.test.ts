import { describe, expect, it } from 'vitest';
import {
  backoffDelay,
  buildSubmit,
  createLocalStore,
  describeServerMessage,
  getOrCreateClientId,
  remainingChars,
  roomFromSearch,
  validateRoomCode,
  type StorageLike,
} from '../src/join-logic.js';

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  };
}

const throwingStorage: StorageLike = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
};

describe('roomFromSearch (FR1.2, FR1.4)', () => {
  it('?room= から正規化したコードを得る', () => {
    expect(roomFromSearch('?room=abcd2345')).toBe('ABCD2345');
  });
  it('room がなければ空文字', () => {
    expect(roomFromSearch('')).toBe('');
    expect(roomFromSearch('?x=1')).toBe('');
  });
  it('不正な文字を含む値は空文字', () => {
    expect(roomFromSearch('?room=ABCD2I45')).toBe('');
    expect(roomFromSearch('?room=ABC')).toBe('');
  });
});

describe('validateRoomCode (FR1.2, FR1.3)', () => {
  it('空はメッセージを返す', () => {
    expect(validateRoomCode('')).toContain('入力');
  });
  it('8文字未満はメッセージを返す', () => {
    expect(validateRoomCode('ABCD')).toContain('8文字');
  });
  it('正しい8文字は null', () => {
    expect(validateRoomCode('ABCD2345')).toBeNull();
  });
});

describe('createLocalStore (FR3.2)', () => {
  it('保存した値を読み戻せる', async () => {
    const s = createLocalStore(memoryStorage());
    await s.set('lastRoom', 'ABCD2345');
    expect(await s.get('lastRoom')).toBe('ABCD2345');
  });
  it('localStorage が例外を投げてもメモリ上に保持する', async () => {
    const s = createLocalStore(throwingStorage);
    await s.set('lastRoom', 'ABCD2345');
    expect(await s.get('lastRoom')).toBe('ABCD2345');
  });
});

describe('getOrCreateClientId (FR3.1)', () => {
  it('初回に形式を満たす値を作り、2回目は同じ値を返す', async () => {
    const s = createLocalStore(memoryStorage());
    const a = await getOrCreateClientId(s, () => 'd3b07384-d9a0-4c1e-8f2b-1234567890ab');
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(await getOrCreateClientId(s, () => 'another-id-should-not-be-used')).toBe(a);
  });
});

describe('再利用するヘルパー (FR2.2, FR2.4, FR2.6, FR3.3)', () => {
  it('buildSubmit は契約どおりの JSON', () => {
    expect(JSON.parse(buildSubmit('こんにちは'))).toEqual({ type: 'submit', text: 'こんにちは' });
  });
  it('describeServerMessage は too_long と ended に日本語を返す', () => {
    expect(describeServerMessage({ type: 'error', code: 'too_long', message: '' })).toMatch(/[ぁ-んァ-ン一-龥]/);
    expect(describeServerMessage({ type: 'ended' })).toBe('ルームは終了しました。');
  });
  it('remainingChars は100コードポイントを基準に数える', () => {
    expect(remainingChars('')).toBe(100);
    expect(remainingChars('😀😀a')).toBe(97);
  });
  it('backoffDelay は上限15秒に収まる', () => {
    expect(backoffDelay(20, () => 1)).toBeLessThanOrEqual(18000);
    expect(backoffDelay(20, () => 0)).toBeGreaterThanOrEqual(12000);
  });
});
