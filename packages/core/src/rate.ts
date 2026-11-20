import { RATE_MAX_PER_WINDOW, RATE_MIN_INTERVAL_MS, RATE_WINDOW_MS } from './constants.js';

export interface RateState {
  /** 直近に受理した時刻(epochミリ秒)。0なら未送信。 */
  lastAt: number;
  /** 現在の窓の開始時刻。 */
  windowStart: number;
  /** 現在の窓内で受理した回数。 */
  windowCount: number;
}

export interface RateResult {
  allowed: boolean;
  state: RateState;
  reason?: 'too_fast' | 'too_many';
}

export const EMPTY_RATE_STATE: RateState = { lastAt: 0, windowStart: 0, windowCount: 0 };

/**
 * レート制限の判定(純粋関数)。
 * 前回から1秒未満は too_fast、1分の窓内で20回を超えると too_many。
 * 拒否した場合は状態を進めない。
 */
export function checkRate(state: RateState | undefined, now: number): RateResult {
  const s = state ?? EMPTY_RATE_STATE;
  if (s.lastAt > 0 && now - s.lastAt < RATE_MIN_INTERVAL_MS) {
    return { allowed: false, state: s, reason: 'too_fast' };
  }
  let windowStart = s.windowStart;
  let windowCount = s.windowCount;
  if (windowStart === 0 || now - windowStart >= RATE_WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= RATE_MAX_PER_WINDOW) {
    return { allowed: false, state: s, reason: 'too_many' };
  }
  return {
    allowed: true,
    state: { lastAt: now, windowStart, windowCount: windowCount + 1 },
  };
}
