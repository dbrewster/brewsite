import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { brewsiteGenPlugin } from './vite-gen-plugin.mjs';

export default defineConfig({
  root: resolve(__dirname, 'vite-app'),
  plugins: [react(), brewsiteGenPlugin()],
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
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', '192.168.1.221'],
    proxy: {
      // Proxy OAuth and Lucid API calls to the local Express server (port 3001).
      // This keeps credentials server-side and avoids browser CORS issues.
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/lucid': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  publicDir: resolve(__dirname, 'public'),
});
