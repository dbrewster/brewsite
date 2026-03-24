// Implementation of `brewsite add <package>`.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { copyAssets } from './copyAssets.js';

/** Map of shorthand names to npm package names. */
export const PACKAGE_MAP: Record<string, { npm: string; dev: boolean }> = {
  'core':          { npm: '@brewsite/core', dev: false },
  'diagram':       { npm: '@brewsite/diagram', dev: false },
  'model':         { npm: '@brewsite/model', dev: false },
  'charts':        { npm: '@brewsite/charts', dev: false },
  'screens':       { npm: '@brewsite/screens', dev: false },
  'textures':      { npm: '@brewsite/textures', dev: false },
  'slides':        { npm: '@brewsite/slides', dev: false },
  'themes':        { npm: '@brewsite/themes', dev: false },
  'mdx':           { npm: '@brewsite/mdx', dev: false },
  'claude-author': { npm: '@brewsite/claude-author', dev: true },
};

/**
 * Walk up from `startDir` looking for `filename`. Returns the directory
 * containing it, or null if the filesystem root is reached.
 */
function findUp(startDir: string, filename: string): string | null {
  let dir = startDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(join(dir, filename))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Detect the package manager in the current project (walks up for lock files). */
export function detectPackageManager(projectRoot: string): 'pnpm' | 'npm' | 'yarn' {
  if (findUp(projectRoot, 'pnpm-lock.yaml')) return 'pnpm';
  if (findUp(projectRoot, 'yarn.lock')) return 'yarn';
  return 'npm';
}

/** True when the cwd is inside a pnpm workspace (walks up for pnpm-workspace.yaml). */
function isInsidePnpmWorkspace(startDir: string): boolean {
  return findUp(startDir, 'pnpm-workspace.yaml') !== null;
}

/** Build the install command string for a given package manager. */
export function buildInstallCommand(
  pm: 'pnpm' | 'npm' | 'yarn',
  npmName: string,
  opts: { dev?: boolean; projectRoot?: string } = {},
): string {
  const devFlag = opts.dev ? (pm === 'npm' ? '--save-dev' : '-D') : '';
  if (pm === 'pnpm') {
    const wsFlag = opts.projectRoot && isInsidePnpmWorkspace(opts.projectRoot) ? '-w' : '';
    return `pnpm add ${wsFlag} ${devFlag} ${npmName}`.replace(/\s+/g, ' ').trim();
  }
  if (pm === 'yarn') {
    return `yarn add ${devFlag} ${npmName}`.replace(/\s+/g, ' ').trim();
  }
  return `npm install ${devFlag} ${npmName}`.replace(/\s+/g, ' ').trim();
}

/** Install a single package using the detected package manager. */
function install(
  projectRoot: string,
  npmName: string,
  opts: { dev?: boolean } = {},
): void {
  const pm = detectPackageManager(projectRoot);
  const cmd = buildInstallCommand(pm, npmName, { ...opts, projectRoot });
  execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
}

/** Packages that ship static assets requiring a copy step. */
const ASSET_PACKAGES = new Set(['diagram']);

/** Run the `brewsite add` command for the given shorthand package names. */
export async function runAdd(shortNames: string[]): Promise<void> {
  const projectRoot = process.cwd();
  let needsClaudeAuthorInit = false;
  let needsAssetCopy = false;

  for (const name of shortNames) {
    const entry = PACKAGE_MAP[name];
    if (!entry) {
      console.error(`Unknown package: ${name}`);
      console.error(`Available: ${Object.keys(PACKAGE_MAP).join(', ')}`);
      process.exit(1);
    }

    console.log(`Installing ${entry.npm}...`);
    install(projectRoot, entry.npm, { dev: entry.dev });

    if (name === 'claude-author') {
      needsClaudeAuthorInit = true;
    }
    if (ASSET_PACKAGES.has(name)) {
      needsAssetCopy = true;
    }
  }

  // Copy static assets (SVG icons, envmaps) to project's public/ directory
  if (needsAssetCopy) {
    console.log('\nCopying static assets to public/...');
    copyAssets({ projectRoot });
  }

  // Run claude-author init if it was added
  if (needsClaudeAuthorInit) {
    console.log('\nSetting up Claude Code integration...');
    execSync('npx @brewsite/claude-author init', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  }

  console.log('\nDone!');
}
