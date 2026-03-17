// Vite plugin for serving and bundling @brewsite/textures assets.

import type { Plugin } from 'vite';
import { resolve, join } from 'path';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';

/**
 * Options for the Vite textures plugin.
 */
export interface BrewsiteTexturesViteOptions {
  /** Output path in the build. Default: 'assets/materials'. */
  publicPath?: string;
  /** Which presets to include. Default: all. Omit presets not used to reduce build size. */
  presets?: string[];
}

/**
 * Vite plugin that serves @brewsite/textures KTX2 assets during development
 * and emits them into the production build output.
 *
 * Dev server: Middleware intercepts requests to `/${publicPath}/...` and serves
 * from the package's `assets/` directory.
 *
 * Production build: Uses `generateBundle` to emit selected preset files and
 * the Basis transcoder into the build output.
 */
export function viteBrewsiteTextures(options?: BrewsiteTexturesViteOptions): Plugin {
  const publicPath = options?.publicPath ?? 'assets/materials';
  const selectedPresets = options?.presets ?? null;

  // Resolve the assets directory from the installed package.
  let assetsDir: string | null = null;

  const resolveAssetsDir = (): string | null => {
    if (assetsDir !== null) return assetsDir;

    // Try to find the assets directory relative to this module.
    const candidates = [
      resolve(__dirname, '../assets'),
      resolve(__dirname, '../../assets'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        assetsDir = candidate;
        return assetsDir;
      }
    }

    // Fallback: try to resolve from node_modules.
    try {
      const pkgPath = require.resolve('@brewsite/textures/package.json');
      const pkgDir = resolve(pkgPath, '..');
      const dir = resolve(pkgDir, 'assets');
      if (existsSync(dir)) {
        assetsDir = dir;
        return assetsDir;
      }
    } catch {
      // Package not found in node_modules — expected during development.
    }

    return null;
  };

  const shouldIncludePreset = (presetName: string): boolean => {
    if (!selectedPresets) return true;
    return selectedPresets.includes(presetName);
  };

  return {
    name: 'brewsite-textures',
    enforce: 'pre',

    configureServer(server) {
      const prefix = `/${publicPath}`;

      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(prefix)) {
          next();
          return;
        }

        const dir = resolveAssetsDir();
        if (!dir) {
          next();
          return;
        }

        const relativePath = req.url.slice(prefix.length);
        const filePath = join(dir, relativePath);

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }

        const content = readFileSync(filePath);
        const ext = filePath.split('.').pop();

        const mimeTypes: Record<string, string> = {
          'ktx2': 'image/ktx2',
          'wasm': 'application/wasm',
          'js': 'application/javascript',
        };

        res.setHeader('Content-Type', mimeTypes[ext ?? ''] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(content);
      });
    },

    generateBundle() {
      const dir = resolveAssetsDir();
      if (!dir) {
        this.warn(
          '[brewsite-textures] Could not find assets directory. ' +
          'Ensure @brewsite/textures is installed and assets are present.',
        );
        return;
      }

      const emitDirectory = (dirPath: string, outputBase: string): void => {
        if (!existsSync(dirPath)) return;

        const entries = readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          const outputPath = join(outputBase, entry.name);

          if (entry.isDirectory()) {
            emitDirectory(fullPath, outputPath);
          } else if (entry.isFile()) {
            this.emitFile({
              type: 'asset',
              fileName: outputPath,
              source: readFileSync(fullPath),
            });
          }
        }
      };

      // Always emit the Basis transcoder.
      const basisDir = join(dir, 'basis');
      emitDirectory(basisDir, join(publicPath, 'basis'));

      // Emit selected presets.
      const presetsDir = join(dir, 'presets');
      if (existsSync(presetsDir)) {
        const presetDirs = readdirSync(presetsDir, { withFileTypes: true });
        for (const presetDir of presetDirs) {
          if (!presetDir.isDirectory()) continue;
          if (!shouldIncludePreset(presetDir.name)) continue;

          emitDirectory(
            join(presetsDir, presetDir.name),
            join(publicPath, 'presets', presetDir.name),
          );
        }
      }
    },
  };
}
