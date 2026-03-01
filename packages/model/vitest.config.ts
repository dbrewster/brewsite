import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core/compiler/registry': resolve(__dirname, '../core/src/compiler/registry.ts'),
      '@brewsite/core/compiler/sceneTypes': resolve(__dirname, '../core/src/compiler/sceneTypes.ts'),
      '@brewsite/core/compiler/transitions/transitionTypes': resolve(__dirname, '../core/src/compiler/transitions/transitionTypes.ts'),
      '@brewsite/core/runtime/types': resolve(__dirname, '../core/src/runtime/types.ts'),
      '@brewsite/core/widget/types': resolve(__dirname, '../core/src/widget/types.ts'),
      '@brewsite/core/widget/WidgetPlugin': resolve(__dirname, '../core/src/widget/WidgetPlugin.ts'),
      '@brewsite/core/widget/WidgetRegistry': resolve(__dirname, '../core/src/widget/WidgetRegistry.ts'),
      // Core must come last (after sub-paths) so specific paths match first
      '@brewsite/core': resolve(__dirname, '../core/src/index.ts'),
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
        'src/elements/**/render.ts',
        'src/elements/**/ModelRenderer.ts',
        'src/labels/render.ts',
        'src/**/index.ts',
      ],
    },
  },
});
