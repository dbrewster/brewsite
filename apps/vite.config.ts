import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const appsRoot = __dirname;

const appPublicDirs: Record<string, string> = {
  website: path.resolve(appsRoot, 'website/public'),
  docs: path.resolve(appsRoot, 'docs/public'),
};

const mimeTypeByExtension: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.hdr': 'image/vnd.radiance',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};

/**
 * Serves static files from each app's public/ directory.
 * Requests to /website/... are resolved against website/public/,
 * requests to /docs/... against docs/public/, and bare paths (/) default to website.
 */
const staticAssetsPlugin = {
  name: 'brewsite-static-assets',
  configureServer(server: ViteDevServer): void {
    server.middlewares.use(async (req, res, next) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') { next(); return; }

      const pathname = (req.url ?? '/').split('?')[0] ?? '/';

      // Determine which app owns this path, strip the prefix, then search public dirs.
      let appKey: string;
      let relativePath: string;

      if (pathname.startsWith('/docs/') || pathname === '/docs') {
        appKey = 'docs';
        relativePath = pathname.slice('/docs'.length) || '/';
      } else {
        // Root and /website/... both resolve from the website public dir.
        appKey = 'website';
        relativePath = pathname.startsWith('/website/')
          ? pathname.slice('/website'.length)
          : pathname;
      }

      const publicDir = appPublicDirs[appKey];
      if (!publicDir) { next(); return; }

      const candidate = path.resolve(publicDir, `.${relativePath}`);
      if (!candidate.startsWith(publicDir)) { next(); return; }

      try {
        const stat = await fs.stat(candidate);
        if (!stat.isFile()) { next(); return; }
        const ext = path.extname(candidate).toLowerCase();
        const contentType = mimeTypeByExtension[ext] ?? 'application/octet-stream';
        const fileBuffer = await fs.readFile(candidate);
        res.setHeader('Content-Type', contentType);
        res.statusCode = 200;
        if (method === 'HEAD') { res.end(); } else { res.end(fileBuffer); }
      } catch {
        next();
      }
    });
  },
};

export default defineConfig({
  root: appsRoot,
  plugins: [react(), staticAssetsPlugin],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: [
      // Sub-path imports (e.g. @brewsite/core/elements/model/types) resolve to src/.
      { find: /^@brewsite\/core\/(.*)$/, replacement: path.resolve(__dirname, '../packages/core/src/$1') },
      { find: /^@brewsite\/diagram\/(.*)$/, replacement: path.resolve(__dirname, '../packages/diagram/src/$1') },
      { find: /^@brewsite\/model\/(.*)$/, replacement: path.resolve(__dirname, '../packages/model/src/$1') },
      // Top-level package imports resolve to each package's TS entry point.
      { find: '@brewsite/core', replacement: path.resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@brewsite/diagram', replacement: path.resolve(__dirname, '../packages/diagram/src/index.ts') },
      { find: '@brewsite/model', replacement: path.resolve(__dirname, '../packages/model/src/index.ts') },
    ],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', '192.168.1.221'],
    fs: {
      allow: [appsRoot, path.resolve(__dirname, '..')],
    },
  },
  publicDir: false,
});
