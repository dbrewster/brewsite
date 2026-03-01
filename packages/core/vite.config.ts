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
      // Use a function so all subpaths of peer deps are marked external, not just the
      // bare specifier. e.g. 'react-dom/client', 'three/examples/jsm/loaders/RGBELoader.js'.
      external: (id: string) =>
        id === 'three'         || id.startsWith('three/') ||
        id === 'react'         || id.startsWith('react/') ||
        id === 'react-dom'     || id.startsWith('react-dom/') ||
        id === 'animejs'       || id.startsWith('animejs/') ||
        id === 'camera-controls',
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
    sourcemap: false,
    // Preserve tsc declaration output emitted to dist before Vite runs.
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, 'src/index.ts'),
    },
  },
});
