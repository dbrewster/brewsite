import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'three', 'react-router'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
    sourcemap: true,
    // Preserve tsc declaration output emitted to dist before Vite runs.
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, 'src/index.ts'),
    },
  },
});
