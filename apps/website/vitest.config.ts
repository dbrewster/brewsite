import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@brewsite\/core\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/core/src/$1'),
      },
      {
        find: /^@brewsite\/diagram\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/diagram/src/$1'),
      },
      {
        find: '@brewsite/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: '@brewsite/diagram',
        replacement: resolve(__dirname, '../../packages/diagram/src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'generated'],
  },
});
