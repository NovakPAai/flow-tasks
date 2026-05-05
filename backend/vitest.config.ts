import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/prisma/**',
        'src/index.ts',
      ],
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
      },
      reporter: ['text', 'json-summary'],
    },
  },
});
