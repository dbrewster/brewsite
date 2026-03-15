// Implementation of `brewsite add <package>`.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Map of shorthand names to npm package names. */
export const PACKAGE_MAP: Record<string, { npm: string; dev: boolean }> = {
  'core':          { npm: '@brewsite/core', dev: false },
  'diagram':       { npm: '@brewsite/diagram', dev: false },
  'model':         { npm: '@brewsite/model', dev: false },
  'charts':        { npm: '@brewsite/charts', dev: false },
  'screens':       { npm: '@brewsite/screens', dev: false },
  'claude-author': { npm: '@brewsite/claude-author', dev: true },
};

/** Detect the package manager in the current project. */
export function detectPackageManager(projectRoot: string): 'pnpm' | 'npm' | 'yarn' {
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/** Build the install command string for a given package manager. */
export function buildInstallCommand(
  pm: 'pnpm' | 'npm' | 'yarn',
  npmName: string,
  opts: { dev?: boolean } = {},
): string {
  const devFlag = opts.dev ? (pm === 'npm' ? '--save-dev' : '-D') : '';
  if (pm === 'pnpm') {
    return `pnpm add ${devFlag} ${npmName}`.replace(/\s+/g, ' ').trim();
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
  const cmd = buildInstallCommand(pm, npmName, opts);
  execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
}

/** Run the `brewsite add` command for the given shorthand package names. */
export async function runAdd(shortNames: string[]): Promise<void> {
  const projectRoot = process.cwd();
  let needsClaudeAuthorInit = false;

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
