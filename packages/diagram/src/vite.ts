// Vite plugin for serving @brewsite/diagram static assets (SVG icons, envmaps).

import type { Plugin } from 'vite';
import { resolve, join } from 'path';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';

/**
 * Options for the Vite diagram assets plugin.
 */
export interface BrewsiteDiagramViteOptions {
  /**
   * URL prefix for shape SVG assets.
   * Default: 'assets/shapes' (served at /assets/shapes/...).
   */
  shapesPath?: string;
  /**
   * URL prefix for environment map assets.
   * Default: 'assets/envmaps' (served at /assets/envmaps/...).
   */
  envmapsPath?: string;
}

/**
 * Vite plugin that serves @brewsite/diagram SVG icon and envmap assets.
 *
 * Dev server: Middleware intercepts requests to `/assets/shapes/...` and
 * `/assets/envmaps/...` and serves them from the package's `public/` directory
 * inside `node_modules/@brewsite/diagram`.
 *
 * Production build: Uses `generateBundle` to emit the asset files into the
 * build output so they're available as static files in the deployed app.
 *
 * Usage:
 * ```ts
 * // vite.config.ts
 * import { viteDiagramAssets } from '@brewsite/diagram/vite';
 *
 * export default defineConfig({
 *   plugins: [viteDiagramAssets()],
 * });
 * ```
 */
export function viteDiagramAssets(options?: BrewsiteDiagramViteOptions): Plugin {
  const shapesPath = options?.shapesPath ?? 'assets/shapes';
  const envmapsPath = options?.envmapsPath ?? 'assets/envmaps';

  // Resolve the public/ directory from the installed package.
  let publicDir: string | null = null;

  const resolvePublicDir = (): string | null => {
    if (publicDir !== null) return publicDir;

    // Try to find relative to this compiled module (works in both dist/ and src/).
    const candidates = [
      resolve(__dirname, '../public'),
      resolve(__dirname, '../../public'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        publicDir = candidate;
        return publicDir;
      }
    }

    // Fallback: resolve from node_modules.
    try {
      const pkgPath = require.resolve('@brewsite/diagram/package.json');
      const pkgDir = resolve(pkgPath, '..');
      const dir = resolve(pkgDir, 'public');
      if (existsSync(dir)) {
        publicDir = dir;
        return publicDir;
      }
    } catch {
      // Package not found — expected during monorepo development.
    }

    return null;
  };

  const MIME_TYPES: Record<string, string> = {
    svg: 'image/svg+xml',
    hdr: 'application/octet-stream',
    png: 'image/png',
    jpg: 'image/jpeg',
    json: 'application/json',
  };

  /** Serve a single static file from the public dir, or call next(). */
  function serveFile(
    assetSubdir: string,
    urlPrefix: string,
    req: { url?: string },
    res: { setHeader(k: string, v: string): void; end(data: Buffer): void },
    next: () => void,
  ): boolean {
    if (!req.url || !req.url.startsWith(`/${urlPrefix}`)) return false;

    const dir = resolvePublicDir();
    if (!dir) return false;

    const relativePath = req.url.slice(`/${urlPrefix}`.length);
    const filePath = join(dir, assetSubdir, relativePath);

    if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;

    const content = readFileSync(filePath);
    const ext = filePath.split('.').pop() ?? '';
    res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(content);
    return true;
  }

  /** Recursively emit all files in a directory into the Rollup bundle. */
  function emitDirectory(
    ctx: { emitFile(file: { type: 'asset'; fileName: string; source: Buffer }): void },
    dirPath: string,
    outputBase: string,
  ): void {
    if (!existsSync(dirPath)) return;

    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = join(dirPath, entry.name);
      const outputPath = join(outputBase, entry.name);

      if (entry.isDirectory()) {
        emitDirectory(ctx, fullPath, outputPath);
      } else if (entry.isFile()) {
        ctx.emitFile({
          type: 'asset',
          fileName: outputPath,
          source: readFileSync(fullPath),
        });
      }
    }
  }

  return {
    name: 'brewsite-diagram-assets',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Try shapes, then envmaps, then pass through.
        if (serveFile('assets/shapes', shapesPath, req, res, next)) return;
        if (serveFile('assets/envmaps', envmapsPath, req, res, next)) return;
        next();
      });
    },

    generateBundle() {
      const dir = resolvePublicDir();
      if (!dir) {
        this.warn(
          '[brewsite-diagram-assets] Could not find public/ directory. ' +
          'Ensure @brewsite/diagram is installed.',
        );
        return;
      }

      emitDirectory(this, join(dir, 'assets/shapes'), shapesPath);
      emitDirectory(this, join(dir, 'assets/envmaps'), envmapsPath);
    },
  };
}
