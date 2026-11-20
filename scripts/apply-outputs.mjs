// `cdk deploy --outputs-file cdk-outputs.json` の出力から、拡張機能の接続先を埋めて再ビルド・ZIP化する。
// 使い方: node scripts/apply-outputs.mjs [--file cdk-outputs.json]
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './build-extension.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const fileIdx = argv.indexOf('--file');
const file = resolve(root, fileIdx >= 0 ? argv[fileIdx + 1] : 'cdk-outputs.json');

let outputs;
try {
  const all = JSON.parse(await readFile(file, 'utf8'));
  outputs = all.WordcloudStack ?? Object.values(all)[0];
} catch (e) {
  console.error(`出力ファイルを読めません: ${file}\n先に \`npm run deploy\` を実行してください。(${e.message})`);
  process.exit(1);
}
if (!outputs?.ApiUrl || !outputs?.WsUrl) {
  console.error('出力に ApiUrl / WsUrl がありません。');
  process.exit(1);
}

const expectedId = (await readFile(resolve(root, 'packages/extension/EXTENSION_ID'), 'utf8')).trim();
if (outputs.ExtensionId && outputs.ExtensionId !== expectedId) {
  console.warn(
    `警告: デプロイ時の拡張機能ID(${outputs.ExtensionId})が manifest の ID(${expectedId})と異なります。CORS で拒否される可能性があります。`,
  );
}

await buildExtension({ api: outputs.ApiUrl, ws: outputs.WsUrl });
console.log(`表示ページ: ${outputs.WebUrl}`);
console.log('dist/wordcloud-extension.zip を参加者に配布してください。');
