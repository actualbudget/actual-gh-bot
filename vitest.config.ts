import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
});
