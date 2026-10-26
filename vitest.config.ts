import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Any *.test.ts outside node_modules, so packages like server/ai can keep tests beside their code.
    exclude: ['**/node_modules/**', 'dist/**', '.claude/**'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
