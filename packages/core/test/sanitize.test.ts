import { describe, expect, it } from 'vitest';
import { MAX_TEXT_LENGTH, sanitize, validateText } from '../src/index.js';

describe('sanitize / validateText (NFR2.3, NFR2.4)', () => {
  it('制御文字を除去し、改行とタブは空白にする', () => {
    expect(sanitize('a\u0000b\u0007c\nd\te')).toBe('abc d e');
  });

  it('HTMLの特殊文字は語として残さない', () => {
    const out = sanitize('<script>alert(1)</script>');
    expect(out).not.toMatch(/[<>&"'`]/);
    expect(out).toContain('script');
  });

  it('連続空白を1つにして前後を除く', () => {
    expect(sanitize('  こんにちは    世界  ')).toBe('こんにちは 世界');
  });

  it('100文字は受理し、101文字は too_long で拒否する', () => {
    expect(validateText('あ'.repeat(MAX_TEXT_LENGTH)).ok).toBe(true);
    const r = validateText('あ'.repeat(MAX_TEXT_LENGTH + 1));
    expect(r).toEqual({ ok: false, code: 'too_long' });
  });

  it('サロゲートペアは1文字として数える', () => {
    expect(validateText('😀'.repeat(100)).ok).toBe(true);
    expect(validateText('😀'.repeat(101)).ok).toBe(false);
  });

  it('空・空白のみ・文字列以外は empty', () => {
    expect(validateText('   ')).toEqual({ ok: false, code: 'empty' });
    expect(validateText(123)).toEqual({ ok: false, code: 'empty' });
  });
});
