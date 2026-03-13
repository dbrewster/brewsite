import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core/compiler/registry': resolve(__dirname, '../core/src/compiler/registry.ts'),
      '@brewsite/core/compiler/transitions/transitionTypes': resolve(
        __dirname, '../core/src/compiler/transitions/transitionTypes.ts',
      ),
      '@brewsite/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    poolOptions: { forks: { singleFork: true, isolate: true } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/render.ts',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/plugin.ts',
      ],
    },
  },
});
