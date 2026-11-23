// SynthDiff、AssemblyHash、RiskDetector のテスト(FR2.3、FR3.2、FR3.6、NFR1.1、NFR5.4)
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeAssemblyHash, verifyAssembly } from '../src/assembly-hash.js';
import { describeRisks, detectRisks } from '../src/risk-detector.js';
import { runSynthDiff } from '../src/synth-diff.js';
import { FAKE_ACCESS_KEY, collector, fakeRunner, ng, ok } from './helpers.js';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deploy-asm-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function put(rel: string, content: string) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

describe('AssemblyHash', () => {
  it('同じ内容なら同じハッシュ(作成順に依存しない)', () => {
    put('a.json', '1');
    put('sub/b.json', '2');
    const h1 = computeAssemblyHash(dir);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
    put('sub/b.json', '2');
    put('a.json', '1');
    expect(computeAssemblyHash(dir)).toBe(h1);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('一文字変えると違うハッシュになる', () => {
    put('a.json', 'abc');
    const h1 = computeAssemblyHash(dir);
    put('a.json', 'abd');
    expect(computeAssemblyHash(dir)).not.toBe(h1);
  });

  it('ファイル名の変更でも違うハッシュになる', () => {
    put('a.json', 'x');
    const h1 = computeAssemblyHash(dir);
    rmSync(join(dir, 'a.json'));
    put('b.json', 'x');
    expect(computeAssemblyHash(dir)).not.toBe(h1);
  });

  it('CDK の一時ファイル(synth.lock、.cache)は対象から除く', () => {
    put('a.json', 'x');
    const h1 = computeAssemblyHash(dir);
    put('synth.lock', 'pid');
    put('asset.1/synth.lock', 'pid');
    put('.cache/entry', 'c');
    expect(computeAssemblyHash(dir)).toBe(h1);
    // .cache 以外の隠しディレクトリや通常のファイルは対象
    put('.other/entry', 'c');
    expect(computeAssemblyHash(dir)).not.toBe(h1);
  });

  it('照合の結果(承認時、現在、一致か不一致か)を表示する', () => {
    put('a.json', 'x');
    const approved = computeAssemblyHash(dir);
    const c1 = collector();
    expect(verifyAssembly(dir, approved, c1.out).match).toBe(true);
    expect(c1.lines.join('\n')).toContain('一致');
    put('a.json', 'tampered');
    const c2 = collector();
    const r = verifyAssembly(dir, approved, c2.out);
    expect(r.match).toBe(false);
    expect(r.approvedHash).toBe(approved);
    expect(r.currentHash).not.toBe(approved);
    expect(c2.lines.join('\n')).toContain('不一致');
    expect(c2.lines.join('\n')).toContain(approved);
  });
});

describe('RiskDetector', () => {
  it('DynamoDB の置換と S3 の削除を検出する', () => {
    const r = detectRisks(fx('diff-replace.txt'));
    expect(r.dataLoss).toEqual([
      { resourceType: 'AWS::DynamoDB::Table', logicalId: 'Table', action: 'replace' },
      { resourceType: 'AWS::S3::Bucket', logicalId: 'OldBucket', action: 'delete' },
    ]);
  });

  it('DynamoDB と S3 以外の削除や更新は検出しない', () => {
    const r = detectRisks(fx('diff-safe.txt'));
    expect(r.dataLoss).toEqual([]);
    expect(r.scaling).toEqual([]);
  });

  it('変更なしなら何も検出しない', () => {
    expect(detectRisks(fx('diff-none.txt'))).toEqual({ dataLoss: [], scaling: [] });
  });

  it('課金モード、同時実行の予約、スロットル値の変更を検出する', () => {
    const r = detectRisks(fx('diff-scaling.txt'));
    expect(r.scaling.map((s) => s.logicalId)).toEqual(['Table', 'HttpStage', 'WsHandler']);
    expect(r.dataLoss).toEqual([]);
  });

  it('色つきの出力でも検出し、同じリソースを二重に数えない', () => {
    const colored = fx('diff-replace.txt').replace(/^\[~\]/gm, '\x1b[33m[~]\x1b[39m').replace(/replace$/gm, 'replace');
    // 色の制御文字の後ろでも検出できること(行頭の ESC を除去してから照合する)
    const r = detectRisks(colored);
    expect(r.dataLoss.filter((d) => d.logicalId === 'Table')).toHaveLength(1);
  });

  it('警告の文言を作る', () => {
    const lines = describeRisks(detectRisks(`${fx('diff-replace.txt')}\n${fx('diff-scaling.txt')}`));
    expect(lines.some((l) => l.includes('データ消失') && l.includes('AWS::DynamoDB::Table'))).toBe(true);
    expect(lines.some((l) => l.includes('スケーリング設定'))).toBe(true);
    expect(describeRisks({ dataLoss: [], scaling: [] })).toEqual([]);
  });

  it('(requires replacement) の行だけで置換を検出する', () => {
    const r = detectRisks('[~] AWS::S3::Bucket WebBucket WebBucketAB\n └─ [~] BucketName (requires replacement)\n');
    expect(r.dataLoss).toEqual([{ resourceType: 'AWS::S3::Bucket', logicalId: 'WebBucket', action: 'replace' }]);
  });
});

describe('SynthDiff', () => {
  it('synth を一度だけ実行し、同じ保存先に cdk diff を実行して、ハッシュを返す', async () => {
    const runner = fakeRunner((c) => {
      if (c.args[1] === 'synth') {
        const out = c.args[c.args.indexOf('--output') + 1];
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, 'WordcloudStack.template.json'), '{}');
        return ok('template');
      }
      return ok(fx('diff-safe.txt'));
    });
    const r = await runSynthDiff({ runner, cwd: dir, env: {} });
    expect(r.ok).toBe(true);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
    const synths = runner.calls.filter((c) => c.args[1] === 'synth');
    expect(synths).toHaveLength(1);
    const diffs = runner.calls.filter((c) => c.args[1] === 'diff');
    expect(diffs).toHaveLength(1);
    expect(diffs[0].args).toEqual(['cdk', 'diff', '--app', r.assemblyDir]);
    expect(synths[0].args).toEqual(['cdk', 'synth', '--app', 'npx tsx infra/bin/app.ts', '--output', r.assemblyDir]);
    expect(r.diffText).toContain('WordcloudStack');
  });

  it('前回の保存先を削除してから生成する', async () => {
    put('cdk.out.deploy/stale.json', 'old');
    const runner = fakeRunner((c) => {
      if (c.args[1] === 'synth') {
        expect(existsSync(join(dir, 'cdk.out.deploy', 'stale.json'))).toBe(false);
        mkdirSync(join(dir, 'cdk.out.deploy'), { recursive: true });
        writeFileSync(join(dir, 'cdk.out.deploy', 'new.json'), '{}');
      }
      return ok('');
    });
    const r = await runSynthDiff({ runner, cwd: dir, env: {} });
    expect(r.ok).toBe(true);
  });

  it('synth の失敗は止まり、diff は実行しない。鍵は伏せる', async () => {
    const runner = fakeRunner(() => ng(`bundling failed ${FAKE_ACCESS_KEY}`));
    const r = await runSynthDiff({ runner, cwd: dir, env: {} });
    expect(r.ok).toBe(false);
    expect(r.failedStage).toBe('synth');
    expect(r.error).not.toContain(FAKE_ACCESS_KEY);
    expect(runner.calls).toHaveLength(1);
  });

  it('diff の失敗も止まる', async () => {
    const runner = fakeRunner((c) => {
      if (c.args[1] === 'synth') {
        mkdirSync(join(dir, 'cdk.out.deploy'), { recursive: true });
        writeFileSync(join(dir, 'cdk.out.deploy', 'a'), '1');
        return ok();
      }
      return ng('diff failed');
    });
    const r = await runSynthDiff({ runner, cwd: dir, env: {} });
    expect(r.failedStage).toBe('diff');
    expect(r.hash).toBeUndefined();
  });

  it('保存先の名前が違うときは何も消さず実行しない', async () => {
    put('other/keep.txt', 'k');
    const runner = fakeRunner(() => ok());
    const r = await runSynthDiff({ runner, cwd: dir, env: {}, assemblyDir: 'other' });
    expect(r.ok).toBe(false);
    expect(runner.calls).toHaveLength(0);
    expect(existsSync(join(dir, 'other', 'keep.txt'))).toBe(true);
  });
});
