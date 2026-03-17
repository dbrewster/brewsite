import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { viteBrewsiteTextures } from '../packages/textures/src/vite';

const appsRoot = __dirname;

/**
 * Maps URL prefix → local public/ directory for each sub-app.
 *
 * Dev:   the middleware routes requests to the matching directory.
 * Build: closeBundle copies each directory into the dist output under
 *        the same prefix so browser-side fetch paths are identical.
 *
 * Routing rules (first match wins):
 *   /docs/...      → docs/public/
 *   /examples/...  → examples/public/
 *   everything else → website/public/ (including bare /website/...)
 */
const appPublicEntries: { prefix: string; appName: string; dir: string }[] = [
  { prefix: '/docs',     appName: 'docs',     dir: path.resolve(appsRoot, 'docs/public') },
  { prefix: '/examples', appName: 'examples', dir: path.resolve(appsRoot, 'examples/public') },
  { prefix: '',          appName: 'website',  dir: path.resolve(appsRoot, 'website/public') },
];

const mimeTypeByExtension: Record<string, string> = {
  '.css':  'text/css; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.hdr':  'image/vnd.radiance',
  '.html': 'text/html; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};

/**
 * Extensions worth logging in dev — binary assets and data files that are
 * likely to be missing or mis-pathed and hard to diagnose otherwise.
 * Routine assets (css, html, png, svg) are intentionally excluded.
 */
const VERBOSE_EXTENSIONS = new Set(['.glb', '.hdr', '.wasm', '.json', '.png', '.jpg']);

const TAG = '[brewsite-static-assets]';

/** Recursively copy src into dest, returning the number of files copied. */
async function copyDir(src: string, dest: string): Promise<number> {
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch {
    return 0; // src doesn't exist — skip silently
  }
  await fs.mkdir(dest, { recursive: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      count++;
    }
  }
  return count;
}

/**
 * Serves static files from each app's public/ directory in dev, and copies
 * them into the build output (mirroring the same URL prefixes) for production.
 */
const staticAssetsPlugin: Plugin = {
  name: 'brewsite-static-assets',

  // ── Dev: middleware ──────────────────────────────────────────────────────────
  configureServer(server: ViteDevServer): void {
    const log   = (msg: string) => server.config.logger.info(`${TAG} ${msg}`, { timestamp: true });
    const warn  = (msg: string) => server.config.logger.warn(`${TAG} ${msg}`, { timestamp: true });
    const error = (msg: string) => server.config.logger.error(`${TAG} ${msg}`, { timestamp: true });

    server.middlewares.use(async (req, res, next) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') { next(); return; }

      const pathname = (req.url ?? '/').split('?')[0] ?? '/';

      // Browser-internal probe paths (Chrome DevTools, etc.) — pass through
      // immediately without logging or attempting to serve from our public dirs.
      if (pathname.startsWith('/.well-known/')) { next(); return; }

      const ext      = path.extname(pathname).toLowerCase();
      const verbose  = VERBOSE_EXTENSIONS.has(ext);

      // Find the first entry whose prefix matches the request path.
      const entry = appPublicEntries.find(
        (e) => e.prefix === '' || pathname.startsWith(e.prefix + '/') || pathname === e.prefix,
      );
      if (!entry) { next(); return; }

      // Strip the prefix to get the path within the app's public dir.
      const relativePath = entry.prefix
        ? (pathname.slice(entry.prefix.length) || '/')
        : pathname;

      // Guard against path traversal.
      const candidate = path.resolve(entry.dir, `.${relativePath}`);
      if (!candidate.startsWith(entry.dir)) { next(); return; }

      if (verbose) {
        log(`serving ${pathname} → ${path.relative(appsRoot, candidate)}`);
      }

      try {
        const stat = await fs.stat(candidate);
        if (!stat.isFile()) {
          // Exists but is a directory — let Vite handle it.
          next();
          return;
        }
        const contentType = mimeTypeByExtension[ext] ?? 'application/octet-stream';
        const fileBuffer  = await fs.readFile(candidate);
        res.setHeader('Content-Type', contentType);
        res.statusCode = 200;
        if (method === 'HEAD') { res.end(); } else { res.end(fileBuffer); }
      } catch (err) {
        // File not found or unreadable.
        if (verbose) {
          // Always surface missing binary/data assets — they will cause silent
          // runtime failures (manifest 404 → model never registers, etc.).
          const reason = (err as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'file not found'
            : `read error: ${(err as Error).message}`;
          error(`FAILED ${pathname} — ${reason} (resolved to ${path.relative(appsRoot, candidate)})`);
        }
        next();
      }
    });
  },

  // ── Build: copy public dirs into dist ────────────────────────────────────────
  closeBundle: {
    sequential: true,
    async handler(this) {
      // Skip during `vite dev` watch mode — assets are served live by the
      // middleware above, no file copy needed.
      if (this.meta.watchMode) return;

      const outDir = path.resolve(appsRoot, 'dist');
      console.log(`\n${TAG} copying static assets to ${path.relative(process.cwd(), outDir)}/`);

      const results = await Promise.allSettled(
        appPublicEntries.map(async ({ appName, prefix, dir }) => {
          const destDir = prefix ? path.join(outDir, prefix) : outDir;
          console.log(`${TAG}   ${appName}: ${path.relative(appsRoot, dir)} → dist${prefix || '/'}`);
          const count = await copyDir(dir, destDir);
          console.log(`${TAG}   ${appName}: ${count} file${count !== 1 ? 's' : ''} copied`);
          return { appName, count };
        }),
      );

      let hasError = false;
      for (const result of results) {
        if (result.status === 'rejected') {
          this.error(`${TAG} copy failed: ${(result.reason as Error).message}`);
          hasError = true;
        }
      }

      if (!hasError) {
        const total = results
          .filter((r): r is PromiseFulfilledResult<{ count: number }> => r.status === 'fulfilled')
          .reduce((sum, r) => sum + r.value.count, 0);
        console.log(`${TAG} done — ${total} total files copied\n`);
      }
    },
  },
};

export default defineConfig({
  root: appsRoot,
  plugins: [react(), staticAssetsPlugin, viteBrewsiteTextures()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: [
      // HUD animejs transition presets were removed from @brewsite/core and
      // co-located as a local widget. Map the old package sub-path so existing
      // scene files continue to resolve until they are individually migrated.
      { find: '@brewsite/core/hud/animejs', replacement: path.resolve(__dirname, 'examples/src/widgets/hud-animejs/index.ts') },

      // Sub-path imports (e.g. @brewsite/core/elements/model/types) resolve to src/.
      { find: /^@brewsite\/core\/(.*)$/,    replacement: path.resolve(__dirname, '../packages/core/src/$1') },
      { find: /^@brewsite\/diagram\/(.*)$/, replacement: path.resolve(__dirname, '../packages/diagram/src/$1') },
      { find: /^@brewsite\/model\/(.*)$/,   replacement: path.resolve(__dirname, '../packages/model/src/$1') },
      { find: /^@brewsite\/charts\/(.*)$/,  replacement: path.resolve(__dirname, '../packages/charts/src/$1') },
      { find: /^@brewsite\/slides\/(.*)$/,  replacement: path.resolve(__dirname, '../packages/slides/src/$1') },
      { find: /^@brewsite\/themes\/(.*)$/,  replacement: path.resolve(__dirname, '../packages/themes/src/$1') },
      { find: /^@brewsite\/screens\/(.*)$/, replacement: path.resolve(__dirname, '../packages/screens/src/$1') },
      { find: /^@brewsite\/textures\/(.*)$/, replacement: path.resolve(__dirname, '../packages/textures/src/$1') },
      // Top-level package imports resolve to each package's TS entry point.
      { find: '@brewsite/core',    replacement: path.resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@brewsite/diagram', replacement: path.resolve(__dirname, '../packages/diagram/src/index.ts') },
      { find: '@brewsite/model',   replacement: path.resolve(__dirname, '../packages/model/src/index.ts') },
      { find: '@brewsite/charts',  replacement: path.resolve(__dirname, '../packages/charts/src/index.ts') },
      { find: '@brewsite/slides',  replacement: path.resolve(__dirname, '../packages/slides/src/index.ts') },
      { find: '@brewsite/themes',  replacement: path.resolve(__dirname, '../packages/themes/src/index.ts') },
      { find: '@brewsite/screens', replacement: path.resolve(__dirname, '../packages/screens/src/index.ts') },
      { find: '@brewsite/textures', replacement: path.resolve(__dirname, '../packages/textures/src/index.ts') },
      { find: '@brewsite/docs',    replacement: path.resolve(__dirname, '../packages/docs/src/index.ts') },
    ],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', '192.168.1.221', '10.20.10.83'],
    fs: {
      allow: [appsRoot, path.resolve(__dirname, '..')],
    },
  },
  publicDir: false,
});
