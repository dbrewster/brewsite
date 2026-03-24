// Copies static assets from installed @brewsite packages into the project's public/ directory.
// Handles diagram SVG icons/envmaps. Extensible for future packages.

import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

/** An asset source: a package name + the subdirectories to copy from its public/ tree. */
interface AssetSource {
  /** npm package name (e.g. '@brewsite/diagram'). */
  npmPackage: string;
  /** Subdirectory inside the package's public/ dir to copy (e.g. 'assets/shapes'). */
  srcSubdir: string;
  /** Destination subdirectory inside the project's public/ dir. Same as srcSubdir by default. */
  destSubdir?: string;
}

/** All known asset sources. Add entries here when new packages ship static assets. */
const ASSET_SOURCES: AssetSource[] = [
  { npmPackage: '@brewsite/diagram', srcSubdir: 'assets/shapes' },
  { npmPackage: '@brewsite/diagram', srcSubdir: 'assets/envmaps' },
];

/**
 * Resolve the installed package's root directory by walking up from the
 * project root looking for it in node_modules.
 */
function resolvePackageDir(projectRoot: string, npmPackage: string): string | null {
  // Try direct node_modules (works for npm, yarn, non-hoisted pnpm)
  const direct = join(projectRoot, 'node_modules', npmPackage);
  if (existsSync(join(direct, 'package.json'))) return direct;

  // Walk up for hoisted monorepo layouts
  let dir = projectRoot;
  for (;;) {
    const candidate = join(dir, 'node_modules', npmPackage);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/** Recursively copy a directory tree, creating destination dirs as needed. */
function copyDirRecursive(src: string, dest: string): number {
  if (!existsSync(src)) return 0;
  mkdirSync(dest, { recursive: true });

  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

export interface CopyAssetsOptions {
  /** Project root directory. Default: process.cwd(). */
  projectRoot?: string;
  /** Destination public directory (relative to projectRoot or absolute). Default: 'public'. */
  publicDir?: string;
  /** Only copy assets for these packages (npm names). Default: all installed. */
  packages?: string[];
}

/**
 * Copies static assets from installed @brewsite packages into the project's
 * public directory so they're served as static files regardless of bundler.
 *
 * Returns the number of files copied.
 */
export function copyAssets(options?: CopyAssetsOptions): number {
  const projectRoot = options?.projectRoot ?? process.cwd();
  const publicDirRel = options?.publicDir ?? 'public';
  const publicDir = resolve(projectRoot, publicDirRel);
  const filterPackages = options?.packages ? new Set(options.packages) : null;

  let totalCopied = 0;

  for (const source of ASSET_SOURCES) {
    if (filterPackages && !filterPackages.has(source.npmPackage)) continue;

    const pkgDir = resolvePackageDir(projectRoot, source.npmPackage);
    if (!pkgDir) {
      // Package not installed — skip silently (it might not be needed)
      continue;
    }

    const srcDir = join(pkgDir, 'public', source.srcSubdir);
    if (!existsSync(srcDir)) {
      console.warn(`  ⚠ ${source.npmPackage}: ${source.srcSubdir} not found in package, skipping`);
      continue;
    }

    const destSubdir = source.destSubdir ?? source.srcSubdir;
    const destDir = join(publicDir, destSubdir);

    const count = copyDirRecursive(srcDir, destDir);
    if (count > 0) {
      console.log(`  ${source.npmPackage}: copied ${count} files → ${publicDirRel}/${destSubdir}/`);
    }
    totalCopied += count;
  }

  return totalCopied;
}

/**
 * CLI entry point for `brewsite copy-assets`.
 */
export function runCopyAssets(args: string[]): void {
  let publicDir = 'public';

  // Parse --dest flag
  const destIndex = args.indexOf('--dest');
  if (destIndex !== -1 && args[destIndex + 1]) {
    publicDir = args[destIndex + 1];
  }

  console.log(`Copying @brewsite static assets to ${publicDir}/...`);
  const count = copyAssets({ publicDir });

  if (count === 0) {
    console.log('No assets to copy (no @brewsite packages with static assets found).');
  } else {
    console.log(`\nCopied ${count} files total.`);
  }
}
