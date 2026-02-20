import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@brewsite/core': '/src/index.ts',
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'examples/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['src/legacy'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: [
        'src/**/__tests__/**/*.ts',
      ],
      exclude: [
        'src/runtime/mocks/**/*.ts',
        // Three.js files — cannot instrument in Node test environment
        'src/elements/**/render.ts',
        'src/elements/**/ModelRenderer.ts',
        'src/labels/render.ts',
        // Barrel files — no logic to test
        'src/**/index.ts',
        'src/legacy',
      ],
    },
  },
});
