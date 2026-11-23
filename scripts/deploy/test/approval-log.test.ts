// ApprovalLog のテスト(FR3.5、NFR1.4、NFR2.4、NFR2.5)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalLog, LOG_KINDS, makeAttemptId } from '../src/approval-log.js';
import { FAKE_ACCESS_KEY } from './helpers.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deploy-log-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const fixedNow = () => new Date('2026-11-23T01:02:03.456Z');

describe('ApprovalLog', () => {
  it('日時(UTC)、attemptId、種類を付けて 1 行 1 件の JSON で書く', () => {
    const log = new ApprovalLog(join(dir, 'deploy-logs', 'approvals.jsonl'), 'A1', { now: fixedNow });
    expect(log.append('start', { user: 'dev', region: 'ap-northeast-1' })).toEqual({ ok: true });
    const lines = readFileSync(log.path, 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      ts: '2026-11-23T01:02:03.456Z',
      attemptId: 'A1',
      kind: 'start',
      user: 'dev',
      region: 'ap-northeast-1',
    });
  });

  it('追記する(上書きしない)', () => {
    const p = join(dir, 'a.jsonl');
    writeFileSync(p, '{"old":true}\n');
    const log = new ApprovalLog(p, 'A2', { now: fixedNow });
    log.append('abort', { stage: '事前確認' });
    log.append('end', { exitCode: 1 });
    const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('{"old":true}');
    expect(JSON.parse(lines[2]).kind).toBe('end');
  });

  it('七種類の行を書ける', () => {
    const log = new ApprovalLog(join(dir, 'k.jsonl'), 'A3', { now: fixedNow });
    for (const k of LOG_KINDS) expect(log.append(k).ok).toBe(true);
    const kinds = readFileSync(log.path, 'utf8')
      .trimEnd()
      .split('\n')
      .map((l) => JSON.parse(l).kind);
    expect(kinds).toEqual([...LOG_KINDS]);
  });

  it('書けないとき(保存先がディレクトリ)は例外にせず失敗を返す', () => {
    const log = new ApprovalLog(dir, 'A4', { now: fixedNow });
    const r = log.append('start');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it('秘密情報を書かない(伏せ字を通す)', () => {
    const log = new ApprovalLog(join(dir, 's.jsonl'), 'A5', { now: fixedNow });
    log.append('abort', { reason: `denied ${FAKE_ACCESS_KEY} aws_session_token=tok999` });
    const text = readFileSync(log.path, 'utf8');
    expect(text).not.toContain(FAKE_ACCESS_KEY);
    expect(text).not.toContain('tok999');
    expect(text).toContain('[REDACTED]');
  });

  it('既定の時計でも書ける', () => {
    const log = new ApprovalLog(join(dir, 'd.jsonl'), 'A6');
    expect(log.append('end').ok).toBe(true);
    expect(JSON.parse(readFileSync(log.path, 'utf8')).ts).toMatch(/Z$/);
  });

  it('attemptId は日時とコミットから作り、コミットがなければ nocommit', () => {
    expect(makeAttemptId(fixedNow(), 'abcdef1234567890')).toBe('20261123T010203Z-abcdef123456');
    expect(makeAttemptId(fixedNow(), undefined)).toBe('20261123T010203Z-nocommit');
  });

  it('.gitignore に deploy-logs/ と cdk.out.deploy/ が載っている(NFR2.4)', () => {
    const gi = readFileSync(resolve(__dirname, '../../../.gitignore'), 'utf8').split('\n');
    expect(gi).toContain('deploy-logs/');
    expect(gi).toContain('cdk.out.deploy/');
  });
});
