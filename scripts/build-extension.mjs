// Chrome拡張機能を dist/extension にビルドし、dist/wordcloud-extension.zip を作る。
// 使い方: node scripts/build-extension.mjs [--api <https://...>] [--ws <wss://...>]
import AdmZip from 'adm-zip';
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extDir = resolve(root, 'packages/extension');
const outDir = resolve(root, 'dist/extension');
const zipPath = resolve(root, 'dist/wordcloud-extension.zip');

export const DEFAULT_API = 'http://localhost:3000';
export const DEFAULT_WS = 'ws://localhost:3000/ws';

/** URL を host_permissions 用の「オリジン/*」にする(ws は http に読み替える)。 */
function hostPattern(url) {
  const u = new URL(url);
  const protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : u.protocol;
  return `${protocol}//${u.host}/*`;
}

export async function buildExtension({ api = DEFAULT_API, ws = DEFAULT_WS } = {}) {
  if (!/^https?:\/\//.test(api)) throw new Error('--api は http(s):// で始まる URL を指定してください');
  if (!/^wss?:\/\//.test(ws)) throw new Error('--ws は ws(s):// で始まる URL を指定してください');

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: [resolve(extDir, 'src/popup.ts')],
    outfile: resolve(outDir, 'popup.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome110',
    minify: true,
    logLevel: 'info',
  });
  await copyFile(resolve(extDir, 'src/popup.html'), resolve(outDir, 'popup.html'));
  await copyFile(resolve(extDir, 'src/popup.css'), resolve(outDir, 'popup.css'));

  const manifest = JSON.parse(await readFile(resolve(extDir, 'manifest.json'), 'utf8'));
  manifest.host_permissions = [...new Set([hostPattern(api), hostPattern(ws)])];
  await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(
    resolve(outDir, 'config.json'),
    JSON.stringify({ apiUrl: api.replace(/\/+$/, ''), wsUrl: ws.replace(/\/+$/, '') }, null, 2) + '\n',
  );

  const zip = new AdmZip();
  zip.addLocalFolder(outDir);
  zip.writeZip(zipPath);
  console.log(`拡張機能をビルドしました: ${outDir}`);
  console.log(`配布用ZIP: ${zipPath}`);
  return { outDir, zipPath };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--api') out.api = argv[++i];
    else if (argv[i] === '--ws') out.ws = argv[++i];
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildExtension(parseArgs(process.argv.slice(2))).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
