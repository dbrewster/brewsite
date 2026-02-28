import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
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
  server: {
    host: true,
    port: 5174,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  publicDir: resolve(__dirname, 'public'),
});
