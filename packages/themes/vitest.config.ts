import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, '../core/src/index.ts'),
      '@brewsite/diagram': resolve(__dirname, '../diagram/src/index.ts'),
      '@brewsite/charts': resolve(__dirname, '../charts/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/index.ts',
        'src/**/types.ts',
      ],
    },
  },
});
