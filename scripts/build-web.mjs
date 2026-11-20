// 表示用Webアプリを packages/web/dist にビルドする(esbuild)。
import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'packages/web/src');
const dist = resolve(root, 'packages/web/dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [resolve(src, 'main.ts')],
  outfile: resolve(dist, 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
});
await copyFile(resolve(src, 'index.html'), resolve(dist, 'index.html'));
await copyFile(resolve(src, 'styles.css'), resolve(dist, 'styles.css'));
console.log(`Webアプリをビルドしました: ${dist}`);
