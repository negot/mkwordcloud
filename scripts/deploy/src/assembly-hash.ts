// テンプレート一式(cloud assembly)のハッシュ(NFR1.1、security-design.md「ハッシュの計算方法」)。
// 通常のファイルを相対パスの昇順に並べ、「相対パス、改行、内容」を SHA-256 に順に与える。
// CDK 自身が作る一時ファイル(synth.lock、.cache 系)は対象から除く。
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 除外するファイル名(どの階層でも)。 */
export const EXCLUDED_FILE_NAMES: readonly string[] = ['synth.lock'];
/** 除外するトップ直下のディレクトリ。 */
export const EXCLUDED_TOP_DIRS: readonly string[] = ['.cache'];

function isExcluded(rel: string): boolean {
  const parts = rel.split('/');
  if (EXCLUDED_TOP_DIRS.includes(parts[0]) && parts.length > 1) return true;
  return EXCLUDED_FILE_NAMES.includes(parts[parts.length - 1]);
}

function listFiles(root: string, relDir = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(root, relDir), { withFileTypes: true })) {
    const rel = relDir ? `${relDir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(root, rel));
    else if (e.isFile() && !lstatSync(join(root, rel)).isSymbolicLink() && !isExcluded(rel)) out.push(rel);
  }
  return out;
}

export function computeAssemblyHash(dir: string): string {
  const files = listFiles(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const h = createHash('sha256');
  for (const rel of files) {
    h.update(rel);
    h.update('\n');
    h.update(readFileSync(join(dir, rel)));
  }
  return h.digest('hex');
}

export interface VerifyResult {
  approvedHash: string;
  currentHash: string;
  match: boolean;
}

/** 承認の後、デプロイの前に計算し直して照合し、結果(一致のときも)を表示する。 */
export function verifyAssembly(dir: string, approvedHash: string, out: (line: string) => void): VerifyResult {
  const currentHash = computeAssemblyHash(dir);
  const match = currentHash === approvedHash;
  out(`承認時のハッシュ: ${approvedHash}`);
  out(`現在のハッシュ  : ${currentHash}`);
  out(match ? '照合結果: 一致' : '照合結果: 不一致(承認した内容と異なるため、デプロイしません)');
  return { approvedHash, currentHash, match };
}
