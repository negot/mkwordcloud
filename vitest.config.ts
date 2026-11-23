import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'infra/test/**/*.test.ts',
      'scripts/deploy/test/**/*.test.ts',
    ],
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      // デプロイスクリプトの追加コードだけを測る(NFR4.1)。しきい値は下げない。
      include: ['scripts/deploy/src/**'],
      reporter: ['text'],
      thresholds: { lines: 80 },
    },
  },
});
