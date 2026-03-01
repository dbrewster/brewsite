import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const injectGaPlugin = {
  name: 'inject-ga',
  transformIndexHtml(html: string): string {
    const gaId = process.env.VITE_GA_MEASUREMENT_ID;
    const script = gaId
      ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>\n` +
        `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>`
      : '';

    return html.replace('<!-- GA_INJECT -->', script);
  },
};

export default defineConfig({
  root: resolve(__dirname),
  base: process.env.DOCS_BASE_PATH ?? '/docs/',
  plugins: [react(), injectGaPlugin],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: [
      {
        find: /^@brewsite\/core\/(.*)$/,
        replacement: resolve(__dirname, '../packages/core/src/$1'),
      },
      {
        find: /^@brewsite\/diagram\/(.*)$/,
        replacement: resolve(__dirname, '../packages/diagram/src/$1'),
      },
      {
        find: '@brewsite/core',
        replacement: resolve(__dirname, '../packages/core/src/index.ts'),
      },
      {
        find: '@brewsite/diagram',
        replacement: resolve(__dirname, '../packages/diagram/src/index.ts'),
      },
    ],
  },
  server: {
    host: true,
    port: 5175,
    fs: {
      // Allow serving GLB/motion files from examples public dir in dev
      allow: ['../apps/examples/public', '..'],
    },
  },
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'react-vendor': ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
});
