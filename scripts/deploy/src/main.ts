// 承認つきデプロイスクリプトの流れの制御(FR3.1 から FR3.7、FR6.1、NFR1.1 から NFR1.5)。
// 実行: npm run deploy(tsx scripts/deploy/src/main.ts)。logical-components.md の「実行の流れ」のとおりに部品をつなぐ。
//
// 記録の規則:
//   - start 行の前に止まったとき: abort 行だけ。
//   - start 行の後に止まったとき(拒否、不一致): approval 行と end 行。
//   - 承認ログに書けないとき(start 行、approval 行): 理由を画面に表示して非ゼロで終了する。デプロイしない。
//   - デプロイを始めた後: deploy 行などの結果の行と end 行。
import { userInfo } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AwsCli } from './aws-cli.js';
import { ApprovalLog, type LogKind, type LogResult, makeAttemptId } from './approval-log.js';
import { verifyAssembly, type VerifyResult } from './assembly-hash.js';
import { type BuildResult, runBuildVerify } from './build-verify.js';
import { type DeployResult, OUTPUTS_FILE, runDeploy } from './deployer.js';
import { type FailureSummary, reportFailure } from './failure-report.js';
import { type HumanCheckResult, runHumanCheck } from './human-check.js';
import { createRunner } from './exec.js';
import { type PostCheckResult, readOutputs, runPostCheck } from './post-deploy.js';
import { type PreflightResult, recheckTracked, runPreflight } from './preflight.js';
import { type ApprovalContext, type ClosableIo, confirmApproval, confirmDataLoss, createReadlineIo } from './prompter.js';
import { redact } from './redact.js';
import { type RiskReport, describeRisks, detectRisks } from './risk-detector.js';
import { StepTimer } from './step-timer.js';
import { type SynthDiffResult, runSynthDiff } from './synth-diff.js';

export const LOG_FILE = 'deploy-logs/approvals.jsonl';

export interface MainDeps {
  now: () => Date;
  user: string;
  interactive: boolean;
  out: (line: string) => void;
  makeLog: (attemptId: string) => { append(kind: LogKind, fields?: Record<string, unknown>): LogResult };
  preflight: () => Promise<PreflightResult>;
  recheck: () => Promise<{ ok: boolean; changed: string[]; error?: string }>;
  build: () => Promise<BuildResult>;
  synthDiff: () => Promise<SynthDiffResult>;
  confirmDataLoss: (report: RiskReport) => Promise<boolean>;
  confirmApproval: (ctx: ApprovalContext) => Promise<boolean>;
  verify: (dir: string, approvedHash: string) => VerifyResult;
  deploy: (assemblyDir: string) => Promise<DeployResult>;
  reportFailure: (region: string) => Promise<FailureSummary>;
  applyOutputs: () => Promise<{ ok: boolean; exitCode?: number }>;
  postCheck: () => Promise<PostCheckResult>;
  webUrl: () => string | undefined;
  humanCheck: (webUrl: string | undefined) => Promise<HumanCheckResult>;
}

/** 終了コード: 0 成功、1 失敗または拒否または中止、2 非対話の環境で実行しなかった。 */
export async function runMain(deps: MainDeps): Promise<number> {
  const { out } = deps;
  if (!deps.interactive) {
    out('対話できない環境(端末ではない)では実行しません。承認と CDK の確認に人が答える必要があります。');
    return 2;
  }

  const timer = new StepTimer({ now: () => deps.now().getTime(), out });

  // 1 事前確認
  let end = timer.begin('事前確認');
  const pre = await deps.preflight();
  end(pre.ok ? '成功' : '失敗');
  const attemptId = makeAttemptId(deps.now(), pre.commit);
  const log = deps.makeLog(attemptId);
  out(`attemptId: ${attemptId}`);

  const row = (kind: LogKind, fields: Record<string, unknown>): boolean => {
    const r = log.append(kind, { user: deps.user, ...fields });
    if (!r.ok) out(`承認ログに書けませんでした(${kind} 行): ${redact(r.error)}`);
    return r.ok;
  };
  const finish = (code: number, extra: Record<string, unknown> = {}): number => {
    const { totalMs } = timer.finish();
    row('end', { exitCode: code, durationMs: totalMs, ...extra });
    return code;
  };
  /** start 行の前に止まる。abort 行だけを書く。 */
  const abort = (stage: string, reasons: string[]): number => {
    for (const r of reasons) out(`中止(${stage}): ${r}`);
    timer.finish();
    row('abort', { stage, reasons, commit: pre.commit });
    return 1;
  };

  if (!pre.ok) return abort('事前確認', pre.failures);
  out(`アカウント: ${pre.identity?.account}  リージョン: ${pre.region}  コミット: ${pre.commit}`);

  // 2 ビルドと検証
  end = timer.begin('ビルドと検証');
  const build = await deps.build();
  end(build.ok ? '成功' : '失敗');
  if (!build.ok) {
    return abort('ビルドと検証', [`${build.failedStep} が終了コード ${build.exitCode} で失敗しました`]);
  }

  // 3 再確認(追跡対象のファイルが変わっていないこと)
  end = timer.begin('再確認');
  const re = await deps.recheck();
  end(re.ok ? '成功' : '失敗');
  if (!re.ok) {
    return abort('再確認', [re.error ?? `ビルドの後に追跡対象のファイルが変わりました: ${re.changed.join(', ')}`]);
  }

  // 4 テンプレート生成と差分
  end = timer.begin('テンプレート生成と差分');
  const synth = await deps.synthDiff();
  end(synth.ok ? '成功' : '失敗');
  if (!synth.ok || !synth.hash) {
    return abort('テンプレート生成と差分', [`${synth.failedStage ?? 'synth'} に失敗しました: ${synth.error ?? ''}`]);
  }
  out(synth.diffText);

  // 5 リスク検出(警告のみ)
  const risks = detectRisks(synth.diffText);
  for (const l of describeRisks(risks)) out(l);
  const hasDataLoss = risks.dataLoss.length > 0;

  // 6 開始の記録(書けなければデプロイしない)
  const summary = synth.diffText.split('\n').filter((l) => /^\s*\[[+\-~]\]\s+AWS::/.test(l)).length;
  if (
    !row('start', {
      account: pre.identity?.account,
      arn: pre.identity?.arn,
      commit: pre.commit,
      region: pre.region,
      assemblyHash: synth.hash,
      changedResources: summary,
      dataLossWarning: hasDataLoss,
      scalingWarning: risks.scaling.length > 0,
    })
  ) {
    out('開始の記録を残せないため、デプロイしません。画面のこの表示が唯一の記録です。');
    return 1;
  }

  // 7a データ消失の確認
  let dataLossAnswer: 'yes' | 'no' | 'not-asked' = 'not-asked';
  if (hasDataLoss) {
    dataLossAnswer = (await deps.confirmDataLoss(risks)) ? 'yes' : 'no';
    if (dataLossAnswer === 'no') {
      out('データ消失を承知しなかったため、デプロイしません。');
      return writeRejection({ dataLossAnswer, decision: 'rejected', reason: 'データ消失の確認で拒否' });
    }
  }

  // 7b 承認プロンプト
  const approved = await deps.confirmApproval({
    account: pre.identity?.account,
    arn: pre.identity?.arn,
    region: pre.region,
    commit: pre.commit,
    hash: synth.hash,
  });
  if (!approved) {
    out('承認されなかったため、デプロイしません。');
    return writeRejection({ dataLossAnswer, decision: 'rejected', reason: '承認プロンプトで拒否' });
  }

  // 8 ハッシュの再照合
  const verify = deps.verify(synth.assemblyDir, synth.hash);
  const hashCheck = { approvedHash: verify.approvedHash, currentHash: verify.currentHash, match: verify.match };
  if (!verify.match) {
    return writeRejection({ dataLossAnswer, decision: 'rejected', reason: 'ハッシュの不一致', hashCheck });
  }

  // 9 承認の判断の記録(書けなければデプロイしない)
  if (!row('approval', { decision: 'approved', dataLossAnswer, hashCheck })) {
    out('承認の記録を残せないため、デプロイしません。画面のこの表示が唯一の記録です。');
    return 1;
  }

  // 10 デプロイ
  end = timer.begin('デプロイ');
  const dep = await deps.deploy(synth.assemblyDir);
  end(dep.ok ? '成功' : dep.status === 'skipped' ? '実行せず' : '失敗');
  if (!dep.ok) {
    let failure: FailureSummary | undefined;
    if (dep.status === 'executed') {
      if (dep.rejectedByCdk) out('CDK の確認で拒否されたため、デプロイは中止されました。');
      else failure = await deps.reportFailure(pre.region);
    }
    row('deploy', {
      result: dep.rejectedByCdk ? 'rejected-by-cdk' : dep.status === 'skipped' ? 'skipped' : 'failed',
      exitCode: dep.exitCode,
      rejectedByCdk: dep.rejectedByCdk,
      stackStatus: failure?.stackStatus,
      failedResources: failure?.failedResources,
    });
    return finish(1);
  }
  let exit = 0;
  if (!row('deploy', { result: 'success', exitCode: dep.exitCode, rejectedByCdk: false })) exit = 1;

  // 11 出力の反映
  end = timer.begin('出力の反映(apply-outputs)');
  const applied = await deps.applyOutputs();
  end(applied.ok ? '成功' : '失敗');
  if (!applied.ok) {
    out(`apply-outputs に失敗しました(終了コード ${applied.exitCode})。${OUTPUTS_FILE} を確認して再実行してください。`);
    return finish(1, { reason: 'apply-outputs の失敗' });
  }

  // 12 デプロイ後の自動確認
  end = timer.begin('自動確認');
  let post: PostCheckResult;
  try {
    post = await deps.postCheck();
  } catch (e) {
    post = {
      ok: false,
      attemptsTotal: 0,
      items: [{ name: '出力ファイル', ok: false, attempts: 0, detail: e instanceof Error ? e.message : String(e) }],
    };
  }
  end(post.ok ? '成功' : '失敗');
  for (const i of post.items) out(`${i.ok ? '○' : '×'} ${i.name}: ${i.detail}(試行 ${i.attempts} 回)`);
  if (!row('postcheck', { ok: post.ok, items: post.items, attemptsTotal: post.attemptsTotal })) exit = 1;
  if (!post.ok) return finish(1);

  // 13 人による確認
  const human = await deps.humanCheck(deps.webUrl());
  if (!row('humancheck', { items: human.items, hasProblem: human.hasProblem })) exit = 1;
  if (human.hasProblem) {
    out('「問題があった」項目があります。原因を直して、再度 npm run deploy を実行してください。');
    exit = 1;
  }

  // 14 結果の記録
  return finish(exit);

  /** start 行の後に止まる: approval 行と end 行を書く。 */
  function writeRejection(fields: Record<string, unknown>): number {
    if (!row('approval', fields)) {
      out('承認の判断を記録できませんでした。画面のこの表示が唯一の記録です。');
      return 1;
    }
    return finish(1);
  }
}

/** 実際の部品をつなぐ。 */
export function createDefaultDeps(cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): MainDeps {
  const runner = createRunner();
  const aws = new AwsCli(runner, env);
  const out = (line: string) => void process.stdout.write(`${redact(line)}\n`);
  const onOutput = (chunk: string) => void process.stdout.write(redact(chunk));
  // 確認プロンプトの入力は必要なときに開き、CDK(標準入力を使う)の前に閉じる。
  let io: ClosableIo | null = null;
  const getIo = (): ClosableIo => (io ??= createReadlineIo());
  const closeIo = () => {
    io?.close();
    io = null;
  };
  const outputsPath = resolve(cwd, OUTPUTS_FILE);
  const logPath = resolve(cwd, LOG_FILE);
  const pfDeps = { runner, aws, env, cwd };
  return {
    now: () => new Date(),
    user: userInfo().username,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    out,
    makeLog: (attemptId) => new ApprovalLog(logPath, attemptId),
    preflight: () => runPreflight(pfDeps),
    recheck: () => recheckTracked(pfDeps),
    build: () => runBuildVerify(runner, { cwd, env, onOutput, onStep: (n) => out(`  - ${n}`) }),
    synthDiff: () => runSynthDiff({ runner, cwd, env }),
    confirmDataLoss: (report) => confirmDataLoss(getIo(), report),
    confirmApproval: (ctx) => confirmApproval(getIo(), ctx),
    verify: (dir, hash) => verifyAssembly(dir, hash, out),
    deploy: (assemblyDir) => {
      closeIo();
      return runDeploy({ runner, cwd, env, assemblyDir, interactive: true, onOutput });
    },
    reportFailure: (region) => reportFailure({ aws, region, out }),
    applyOutputs: async () => {
      const r = await runner.capture('npm', ['run', 'apply-outputs'], { cwd, env, onOutput });
      return { ok: r.code === 0, exitCode: r.code };
    },
    postCheck: () =>
      runPostCheck(readOutputs(outputsPath), { fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) }),
    webUrl: () => {
      try {
        return readOutputs(outputsPath).webUrl;
      } catch {
        return undefined;
      }
    },
    humanCheck: (url) => runHumanCheck(getIo(), url),
  };
}

/* v8 ignore start */
// 直接実行されたときだけ動く(テストから import したときは動かない)。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMain(createDefaultDeps()).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`予期しないエラー: ${redact(e instanceof Error ? e.message : String(e))}\n`);
      process.exit(1);
    },
  );
}
/* v8 ignore stop */
