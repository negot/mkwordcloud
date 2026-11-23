// 事前確認(FR3.7、NFR1.2、NFR3.5、NFR2.2)。AWS への読み取りと git の確認だけを行い、何も変更しない。
import type { AwsCli, CallerIdentity } from './aws-cli.js';
import type { Runner } from './exec.js';

export const STACK_NAME = 'WordcloudStack';
export const BOOTSTRAP_STACK_NAME = 'CDKToolkit';
export const DEFAULT_REGION = 'ap-northeast-1';

/** git 管理外のはずだが、念のため確認の対象から除く(security-design.md「未コミットの変更」)。 */
const IGNORED_PREFIXES = ['deploy-logs/', 'cdk.out.deploy/'];

/** 更新できるスタックの状態。 */
const UPDATABLE = new Set([
  'CREATE_COMPLETE',
  'UPDATE_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
  'IMPORT_COMPLETE',
  'IMPORT_ROLLBACK_COMPLETE',
]);

export interface PreflightDeps {
  runner: Runner;
  aws: AwsCli;
  env: NodeJS.ProcessEnv;
  cwd: string;
}

export interface PreflightResult {
  ok: boolean;
  failures: string[];
  region: string;
  identity?: CallerIdentity;
  commit?: string;
  stackStatus?: string | null;
}

/** リージョンの形式(ap-northeast-1 など)。 */
export function isValidRegion(region: string): boolean {
  return /^[a-z]{2}(-[a-z]+)+-\d{1,2}$/.test(region);
}

/** AWS_PROFILE の形式(使う前に検証する。NFR2.3)。 */
export function isValidProfile(profile: string): boolean {
  return /^[A-Za-z0-9_.@+=,-]{1,128}$/.test(profile);
}

function porcelainPaths(stdout: string): string[] {
  return stdout
    .split('\n')
    .filter((l) => l.length > 3)
    .map((l) => l.slice(3).replace(/^"|"$/g, ''))
    .filter((p) => !IGNORED_PREFIXES.some((pre) => p.startsWith(pre)));
}

/** 未コミットの変更(未追跡を含む)の一覧。git が使えないときは例外。 */
async function dirtyPaths(deps: PreflightDeps, includeUntracked: boolean): Promise<string[]> {
  const args = ['status', '--porcelain', includeUntracked ? '--untracked-files=all' : '--untracked-files=no'];
  const r = await deps.runner.capture('git', args, { cwd: deps.cwd });
  if (r.code !== 0) throw new Error(`git status に失敗しました: ${r.stderr.trim()}`);
  return porcelainPaths(r.stdout);
}

/** ビルドと検証の後の再確認: 追跡対象のファイルが変わっていないこと(security-design.md)。 */
export async function recheckTracked(deps: PreflightDeps): Promise<{ ok: boolean; changed: string[]; error?: string }> {
  try {
    const changed = await dirtyPaths(deps, false);
    return { ok: changed.length === 0, changed };
  } catch (e) {
    return { ok: false, changed: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function settle<T>(p: Promise<T>): Promise<{ value: T } | { error: string }> {
  try {
    return { value: await p };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runPreflight(deps: PreflightDeps): Promise<PreflightResult> {
  const failures: string[] = [];
  const region = deps.env.WORDCLOUD_REGION ?? DEFAULT_REGION;
  const profile = deps.env.AWS_PROFILE;

  if (!isValidRegion(region)) failures.push(`WORDCLOUD_REGION の形式が正しくありません: ${region}`);
  if (profile !== undefined && !isValidProfile(profile)) failures.push('AWS_PROFILE の形式が正しくありません');
  const awsOk = failures.length === 0;

  // 確認は並列に実行する(NFR3.5)。形式が不正なときは AWS を呼ばない。
  const [dirty, commit, identity, bootstrap, stack] = await Promise.all([
    settle(dirtyPaths(deps, true)),
    settle(
      deps.runner.capture('git', ['rev-parse', 'HEAD'], { cwd: deps.cwd }).then((r) => {
        if (r.code !== 0) throw new Error('コミットのハッシュを取得できません');
        return r.stdout.trim();
      }),
    ),
    awsOk ? settle(deps.aws.callerIdentity()) : Promise.resolve({ error: '' }),
    awsOk ? settle(deps.aws.stackStatus(BOOTSTRAP_STACK_NAME, region)) : Promise.resolve({ error: '' }),
    awsOk ? settle(deps.aws.stackStatus(STACK_NAME, region)) : Promise.resolve({ error: '' }),
  ]);

  if ('error' in dirty) failures.push(dirty.error);
  else if (dirty.value.length > 0) {
    failures.push(
      `未コミットの変更があります。コミットしてから実行してください: ${dirty.value.slice(0, 20).join(', ')}` +
        (dirty.value.length > 20 ? ` ほか ${dirty.value.length - 20} 件` : ''),
    );
  }

  const result: PreflightResult = { ok: false, failures, region };
  if ('value' in commit) result.commit = commit.value;
  else failures.push(commit.error);

  if (awsOk) {
    if ('error' in identity) {
      failures.push(`AWS の認証を確認できません(IAM Identity Center にサインインしてください): ${identity.error}`);
    } else {
      result.identity = identity.value;
    }

    if ('error' in bootstrap) failures.push(`${BOOTSTRAP_STACK_NAME} の状態を確認できません: ${bootstrap.error}`);
    else if (bootstrap.value === null) {
      failures.push(`${region} は CDK のブートストラップが済んでいません(${BOOTSTRAP_STACK_NAME} がありません)`);
    } else if (!UPDATABLE.has(bootstrap.value)) {
      failures.push(`${BOOTSTRAP_STACK_NAME} の状態が ${bootstrap.value} です`);
    }

    if ('error' in stack) failures.push(`${STACK_NAME} の状態を確認できません: ${stack.error}`);
    else {
      result.stackStatus = stack.value;
      // 存在しない(初回)は更新できる。状態は許可した一覧に入っているものだけを許す。
      if (stack.value !== null && !UPDATABLE.has(stack.value)) {
        failures.push(`${STACK_NAME} は更新できない状態です: ${stack.value}`);
      }
    }
  }

  result.ok = failures.length === 0;
  return result;
}
