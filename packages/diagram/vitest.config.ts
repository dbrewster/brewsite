import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@brewsite/diagram': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/elements/**/render.ts',    // Three.js — excluded per project convention
        'src/elements/**/_shared/**',   // Three.js shared utilities
        'src/elements/**/widget.ts',    // Widget integration — wires compile+render, integration tested
        'src/**/index.ts',              // barrel files — no logic
        'src/compiler/handlers.ts',     // registration side-effect — integration tested
      ],
    },
  },
});
