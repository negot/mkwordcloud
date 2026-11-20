import { describe, expect, it } from 'vitest';
import {
  EMPTY_RATE_STATE,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  checkRate,
  generateHostKey,
  generateRoomCode,
  hashHostKey,
  isValidRoomCode,
  normalizeRoomCode,
  verifyHostKey,
  type RateState,
} from '../src/index.js';

describe('ルームコードと主催者キー (FR1.2, NFR2.7)', () => {
  it('ルームコードは8文字以上で、紛らわしい文字を含まない', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(ROOM_CODE_LENGTH).toBeGreaterThanOrEqual(8);
      expect(isValidRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[ILO01]/);
    }
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO01]/);
  });

  it('不正な形式のコードは拒否し、入力は正規化できる', () => {
    expect(isValidRoomCode('abc')).toBe(false);
    expect(isValidRoomCode('AAAAAAA0')).toBe(false);
    expect(normalizeRoomCode(' abcd efgh ')).toBe('ABCDEFGH');
  });

  it('主催者キーはハッシュで照合でき、誤ったキーは拒否する', () => {
    const key = generateHostKey();
    expect(key.length).toBeGreaterThanOrEqual(32);
    const hash = hashHostKey(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key);
    expect(verifyHostKey(key, hash)).toBe(true);
    expect(verifyHostKey(key + 'x', hash)).toBe(false);
    expect(verifyHostKey(undefined, hash)).toBe(false);
    expect(verifyHostKey('', hash)).toBe(false);
  });
});

describe('レート制限 (NFR2.5)', () => {
  it('初回は許可される', () => {
    const r = checkRate(undefined, 10_000);
    expect(r.allowed).toBe(true);
    expect(r.state.windowCount).toBe(1);
  });

  it('1秒未満の2回目は too_fast、1秒後は許可', () => {
    const first = checkRate(EMPTY_RATE_STATE, 10_000);
    const fast = checkRate(first.state, 10_500);
    expect(fast).toMatchObject({ allowed: false, reason: 'too_fast' });
    expect(fast.state).toEqual(first.state);
    expect(checkRate(first.state, 11_000).allowed).toBe(true);
  });

  it('1分に20回を超えると too_many、窓が過ぎると再び許可', () => {
    let state: RateState = EMPTY_RATE_STATE;
    let now = 100_000;
    for (let i = 0; i < 20; i++) {
      const r = checkRate(state, now);
      expect(r.allowed).toBe(true);
      state = r.state;
      now += 1000;
    }
    const over = checkRate(state, now);
    expect(over).toMatchObject({ allowed: false, reason: 'too_many' });
    expect(checkRate(state, 100_000 + 61_000).allowed).toBe(true);
  });
});
