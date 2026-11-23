// 共通部品のテスト: redact、exec、StepTimer、AwsCli(NFR2.3、NFR3.1、NFR3.4)
import { describe, expect, it } from 'vitest';
import { AwsCli, AwsCliError } from '../src/aws-cli.js';
import { createRunner } from '../src/exec.js';
import { redact } from '../src/redact.js';
import { StepTimer, TIME_BUDGET_MS, formatDuration } from '../src/step-timer.js';
import { FAKE_ACCESS_KEY, FAKE_SESSION_KEY, collector, fakeRunner, ng, ok } from './helpers.js';

describe('redact', () => {
  it('AKIA と ASIA で始まるキー ID を伏せる', () => {
    const r = redact(`key=${FAKE_ACCESS_KEY} tmp=${FAKE_SESSION_KEY}`);
    expect(r).not.toContain(FAKE_ACCESS_KEY);
    expect(r).not.toContain(FAKE_SESSION_KEY);
    expect(r).toContain('[REDACTED]');
  });

  it('シークレットとセッショントークンの値を伏せ、名前は残す', () => {
    const r = redact('aws_secret_access_key = abc/DEF+123\naws_session_token: tok123');
    expect(r).toContain('aws_secret_access_key');
    expect(r).not.toContain('abc/DEF+123');
    expect(r).not.toContain('tok123');
  });

  it('JSON 形式の値も伏せる', () => {
    expect(redact('{"SecretAccessKey": "zzz999"}')).not.toContain('zzz999');
  });

  it('通常の文字列は変えない', () => {
    const s = 'WordcloudStack は UPDATE_COMPLETE です。arn:aws:iam::123456789012:user/x';
    expect(redact(s)).toBe(s);
  });
});

describe('exec(実際の子プロセス: node だけを使う)', () => {
  const runner = createRunner();

  it('シェルを通さず、メタ文字を含む引数がそのまま渡る', async () => {
    const arg = 'a b; echo hacked && $HOME `x`';
    const r = await runner.capture(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', arg]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(arg);
  });

  it('終了コードと標準エラーを返し、onOutput に流す', async () => {
    const chunks: string[] = [];
    const r = await runner.capture(
      process.execPath,
      ['-e', 'console.error("oops");process.exit(3)'],
      { onOutput: (c) => void chunks.push(c) },
    );
    expect(r.code).toBe(3);
    expect(r.stderr).toContain('oops');
    expect(chunks.join('')).toContain('oops');
  });

  it('存在しないコマンドは終了コード 127', async () => {
    const r = await runner.capture('definitely-not-a-command-xyz', []);
    expect(r.code).toBe(127);
    expect(r.stderr.length).toBeGreaterThan(0);
  });

  it('interactive も出力を取得できる', async () => {
    const r = await runner.interactive(process.execPath, ['-e', 'process.stdout.write("hi")'], {
      env: process.env,
    });
    expect(r).toEqual({ code: 0, stdout: 'hi', stderr: '' });
  });
});

describe('StepTimer', () => {
  it('開始、終了、結果、所要時間を表示する', () => {
    let t = 0;
    const c = collector();
    const timer = new StepTimer({ now: () => t, out: c.out });
    const end = timer.begin('事前確認');
    t = 65_000;
    end('成功');
    expect(c.lines[0]).toContain('事前確認 を開始');
    expect(c.lines[1]).toContain('事前確認: 成功(1分5秒)');
    expect(timer.steps).toEqual([{ name: '事前確認', result: '成功', durationMs: 65_000 }]);
  });

  it('15 分以内なら目安超過の表示をしない', () => {
    let t = 0;
    const c = collector();
    const timer = new StepTimer({ now: () => t, out: c.out });
    t = TIME_BUDGET_MS;
    const r = timer.finish();
    expect(r.exceeded).toBe(false);
    expect(c.lines.join('\n')).not.toContain('目安');
  });

  it('15 分を超えたら目安を超えたと表示する(失敗にはしない)', () => {
    let t = 0;
    const c = collector();
    const timer = new StepTimer({ now: () => t, out: c.out });
    t = TIME_BUDGET_MS + 1000;
    const r = timer.finish();
    expect(r.exceeded).toBe(true);
    expect(c.lines.join('\n')).toContain('目安の 15 分を超えました');
  });

  it('formatDuration は秒と分を整形する', () => {
    expect(formatDuration(4_000)).toBe('4秒');
    expect(formatDuration(125_000)).toBe('2分5秒');
  });
});

describe('AwsCli', () => {
  it('STS の応答からアカウント ID と ARN を読む', async () => {
    const r = fakeRunner(() => ok(JSON.stringify({ Account: '111122223333', Arn: 'arn:aws:sts::111122223333:assumed-role/x/y' })));
    const id = await new AwsCli(r).callerIdentity();
    expect(id).toEqual({ account: '111122223333', arn: 'arn:aws:sts::111122223333:assumed-role/x/y' });
    expect(r.calls[0].command).toBe('aws');
    expect(r.calls[0].args.slice(0, 2)).toEqual(['sts', 'get-caller-identity']);
  });

  it('認証切れ(終了コード非ゼロ)は AwsCliError で、鍵は伏せる', async () => {
    const r = fakeRunner(() => ng(`token expired ${FAKE_ACCESS_KEY}`, 255));
    const p = new AwsCli(r).callerIdentity();
    await expect(p).rejects.toBeInstanceOf(AwsCliError);
    await expect(p).rejects.not.toThrow(FAKE_ACCESS_KEY);
  });

  it('STS の応答が不完全ならエラー', async () => {
    const r = fakeRunner(() => ok('{"Account":"1"}'));
    await expect(new AwsCli(r).callerIdentity()).rejects.toThrow('ARN');
  });

  it('JSON でない出力はエラー', async () => {
    const r = fakeRunner(() => ok('not json'));
    await expect(new AwsCli(r).callerIdentity()).rejects.toThrow('JSON');
  });

  it('スタックの状態を読み、存在しなければ null', async () => {
    const r1 = fakeRunner(() => ok(JSON.stringify({ Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }] })));
    expect(await new AwsCli(r1).stackStatus('WordcloudStack', 'ap-northeast-1')).toBe('UPDATE_COMPLETE');
    expect(r1.calls[0].args).toContain('--region');
    const r2 = fakeRunner(() => ng('An error occurred (ValidationError): Stack with id X does not exist'));
    expect(await new AwsCli(r2).stackStatus('X', 'ap-northeast-1')).toBeNull();
  });

  it('スタックの状態の取得で、存在しない以外の失敗と不正な応答はエラー', async () => {
    await expect(
      new AwsCli(fakeRunner(() => ng('AccessDenied'))).stackStatus('X', 'ap-northeast-1'),
    ).rejects.toThrow('AccessDenied');
    await expect(new AwsCli(fakeRunner(() => ok('xx'))).stackStatus('X', 'r')).rejects.toThrow('JSON');
    await expect(new AwsCli(fakeRunner(() => ok('{"Stacks":[]}'))).stackStatus('X', 'r')).rejects.toThrow('状態');
  });

  it('失敗したイベントだけを新しい順に取り出す', async () => {
    const r = fakeRunner(() =>
      ok(
        JSON.stringify({
          StackEvents: [
            { LogicalResourceId: 'Fn', ResourceStatus: 'UPDATE_FAILED', ResourceStatusReason: 'boom' },
            { LogicalResourceId: 'Tbl', ResourceStatus: 'UPDATE_COMPLETE' },
            { ResourceStatus: 'CREATE_FAILED' },
          ],
        }),
      ),
    );
    const ev = await new AwsCli(r).failedEvents('WordcloudStack', 'ap-northeast-1');
    expect(ev).toEqual([
      { logicalId: 'Fn', status: 'UPDATE_FAILED', reason: 'boom' },
      { logicalId: '(不明)', status: 'CREATE_FAILED', reason: '' },
    ]);
  });
});
