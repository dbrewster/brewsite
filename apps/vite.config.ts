import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { brewsiteGenPlugin } from './examples/vite-gen-plugin.mjs';

type AppName = 'website' | 'docs' | 'examples';

const appsRoot = __dirname;
const examplesRoot = path.resolve(__dirname, 'examples');

const appPublicDir: Record<AppName, string> = {
  website: path.resolve(appsRoot, 'website/public'),
  docs: path.resolve(appsRoot, 'docs/public'),
  examples: path.resolve(examplesRoot, 'public'),
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

const dedupe = (apps: AppName[]): AppName[] => {
  const seen = new Set<AppName>();
  const out: AppName[] = [];
  for (const app of apps) {
    if (!seen.has(app)) {
      seen.add(app);
      out.push(app);
    }
  }
  return out;
};

const appFromPathname = (pathname: string): AppName | null => {
  if (pathname === '/' || pathname === '/website' || pathname.startsWith('/website/')) return 'website';
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'docs';
  if (pathname === '/examples' || pathname.startsWith('/examples/')) return 'examples';
  return null;
};

const inferAppFromReferer = (referer: string | undefined): AppName | null => {
  if (!referer) return null;
  try {
    const { pathname } = new URL(referer);
    return appFromPathname(pathname);
  } catch {
    return null;
  }
};

const resolveFileFromPublic = async (pathname: string, refererApp: AppName | null): Promise<string | null> => {
  const normalizedPath = path.posix.normalize(pathname);
  if (!normalizedPath.startsWith('/')) return null;

  const prefixedApp = appFromPathname(normalizedPath);
  const prefixedBase = prefixedApp === 'website' ? '/website' : prefixedApp ? `/${prefixedApp}` : null;

  const relativePath = prefixedBase && normalizedPath.startsWith(`${prefixedBase}/`)
    ? normalizedPath.slice(prefixedBase.length)
    : normalizedPath;

  const orderedApps = dedupe([
    ...(prefixedApp ? [prefixedApp] : []),
    ...(refererApp ? [refererApp] : []),
    'examples',
    'docs',
    'website',
  ]);

  for (const app of orderedApps) {
    const publicDir = appPublicDir[app];
    const candidate = path.resolve(publicDir, `.${relativePath}`);
    if (!candidate.startsWith(publicDir)) {
      continue;
    }
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      // continue searching
    }
  }

  return null;
};

const staticAssetsPlugin = {
  name: 'brewsite-unified-static-assets',
  configureServer(server: ViteDevServer): void {
    server.middlewares.use(async (req, res, next) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        next();
        return;
      }

      const requestUrl = req.url ?? '/';
      const pathname = requestUrl.split('?')[0] ?? '/';
      const refererApp = inferAppFromReferer(req.headers.referer as string | undefined);

      const staticPath = await resolveFileFromPublic(pathname, refererApp);
      if (!staticPath) {
        next();
        return;
      }

      const ext = path.extname(staticPath).toLowerCase();
      const contentType = mimeTypeByExtension[ext] ?? 'application/octet-stream';
      const fileBuffer = await fs.readFile(staticPath);
      res.setHeader('Content-Type', contentType);
      res.statusCode = 200;
      if (method === 'HEAD') {
        res.end();
      } else {
        res.end(fileBuffer);
      }
    });
  },
};

export default defineConfig({
  root: appsRoot,
  plugins: [react(), brewsiteGenPlugin({ projectRoot: examplesRoot }), staticAssetsPlugin],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: [
      {
        find: /^@brewsite\/core\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/core/src/$1'),
      },
      {
        find: /^@brewsite\/diagram\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/diagram/src/$1'),
      },
      {
        find: '@brewsite/core',
        replacement: path.resolve(__dirname, '../packages/core/src/index.ts'),
      },
      {
        find: '@brewsite/diagram',
        replacement: path.resolve(__dirname, '../packages/diagram/src/index.ts'),
      },
    ],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', '192.168.1.221'],
    fs: {
      allow: [appsRoot, path.resolve(__dirname, '..')],
    },
    proxy: {
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
  publicDir: false,
});
