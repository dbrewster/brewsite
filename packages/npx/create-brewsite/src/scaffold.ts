// Project scaffolding: installs packages, writes starter files, runs claude-author init.

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

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
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/**
 * Detect the package manager in the current project.
 * Walks up the directory tree to find lock files — matching the behavior
 * of pnpm/yarn which resolve workspaces from ancestor directories.
 * Falls back to npm if none detected.
 */
export function detectPackageManager(projectRoot: string): 'pnpm' | 'npm' | 'yarn' {
  if (findUp(projectRoot, 'pnpm-lock.yaml')) return 'pnpm';
  if (findUp(projectRoot, 'yarn.lock')) return 'yarn';
  return 'npm';
}

/**
 * True when the cwd is inside a pnpm workspace (pnpm-workspace.yaml exists
 * at the cwd or any ancestor). pnpm refuses `pnpm add` without `-w` when
 * run inside a workspace — this detection lets us add the flag automatically.
 */
function isInsidePnpmWorkspace(startDir: string): boolean {
  return findUp(startDir, 'pnpm-workspace.yaml') !== null;
}

/**
 * Build the install command string for a given package manager.
 * Automatically adds `-w` when running inside a pnpm workspace.
 */
export function buildInstallCommand(
  pm: 'pnpm' | 'npm' | 'yarn',
  packages: string[],
  opts: { dev?: boolean; projectRoot?: string } = {},
): string {
  const devFlag = opts.dev ? (pm === 'npm' ? '--save-dev' : '-D') : '';
  if (pm === 'pnpm') {
    const wsFlag = opts.projectRoot && isInsidePnpmWorkspace(opts.projectRoot) ? '-w' : '';
    return `pnpm add ${wsFlag} ${devFlag} ${packages.join(' ')}`.replace(/\s+/g, ' ').trim();
  }
  if (pm === 'yarn') {
    return `yarn add ${devFlag} ${packages.join(' ')}`.replace(/\s+/g, ' ').trim();
  }
  return `npm install ${devFlag} ${packages.join(' ')}`.replace(/\s+/g, ' ').trim();
}

/**
 * Install packages using the detected package manager.
 */
function installPackages(
  projectRoot: string,
  packages: string[],
  opts: { dev?: boolean } = {},
): void {
  const pm = detectPackageManager(projectRoot);
  const cmd = buildInstallCommand(pm, packages, { ...opts, projectRoot });
  execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
}

/**
 * Scaffold a new BrewSite project.
 */
export async function scaffoldProject(config: ProjectConfig): Promise<void> {
  const { projectRoot, packages, installClaudeAuthor } = config;

  // 1. Install selected @brewsite/* packages as dependencies
  if (packages.length > 0) {
    installPackages(projectRoot, packages);
  }

  // 2. Install dev dependencies (type definitions, and optionally claude-author)
  const devDeps = ['@types/three', '@types/react', '@types/react-dom', 'typescript'];
  if (installClaudeAuthor) devDeps.push('@brewsite/claude-author');
  installPackages(projectRoot, devDeps, { dev: true });

  // 3. Write starter scene if no scenes directory exists
  const scenesDir = join(projectRoot, 'src', 'scenes');
  const starterPath = join(scenesDir, 'intro.tsx');
  if (!existsSync(starterPath)) {
    mkdirSync(scenesDir, { recursive: true });
    copyFileSync(join(TEMPLATES_DIR, 'starter-scene.tsx'), starterPath);
    console.log('  Created src/scenes/intro.tsx');
  }

  // 4. Write App.tsx if not present
  const appPath = join(projectRoot, 'src', 'App.tsx');
  if (!existsSync(appPath)) {
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    copyFileSync(join(TEMPLATES_DIR, 'App.tsx'), appPath);
    console.log('  Created src/App.tsx');
  }

  // 6. Write tsconfig.json if not present
  const tsconfigPath = join(projectRoot, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    copyFileSync(join(TEMPLATES_DIR, 'tsconfig.json'), tsconfigPath);
    console.log('  Created tsconfig.json');
  }

  // 7. Run claude-author init (shells out — no direct dependency)
  if (installClaudeAuthor) {
    console.log('\nSetting up Claude Code integration...');
    execSync('npx @brewsite/claude-author init', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  }
}
