// Tests for the brewsite add command's package resolution and command generation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PACKAGE_MAP, detectPackageManager, buildInstallCommand } from '../src/add.js';

describe('PACKAGE_MAP', () => {
  it('maps shorthand "diagram" to @brewsite/diagram', () => {
    expect(PACKAGE_MAP['diagram']).toEqual({ npm: '@brewsite/diagram', dev: false });
  });

  it('maps shorthand "model" to @brewsite/model', () => {
    expect(PACKAGE_MAP['model']).toEqual({ npm: '@brewsite/model', dev: false });
  });

  it('maps shorthand "charts" to @brewsite/charts', () => {
    expect(PACKAGE_MAP['charts']).toEqual({ npm: '@brewsite/charts', dev: false });
  });

  it('maps shorthand "screens" to @brewsite/screens', () => {
    expect(PACKAGE_MAP['screens']).toEqual({ npm: '@brewsite/screens', dev: false });
  });

  it('maps shorthand "core" to @brewsite/core', () => {
    expect(PACKAGE_MAP['core']).toEqual({ npm: '@brewsite/core', dev: false });
  });

  it('maps shorthand "claude-author" to @brewsite/claude-author with dev flag', () => {
    expect(PACKAGE_MAP['claude-author']).toEqual({ npm: '@brewsite/claude-author', dev: true });
  });

  it('returns undefined for unknown package names', () => {
    expect(PACKAGE_MAP['unknown']).toBeUndefined();
  });
});

describe('detectPackageManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `brewsite-add-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(tempDir)).toBe('pnpm');
  });

  it('detects yarn from yarn.lock', () => {
    writeFileSync(join(tempDir, 'yarn.lock'), '');
    expect(detectPackageManager(tempDir)).toBe('yarn');
  });

  it('falls back to npm when no lock file exists', () => {
    expect(detectPackageManager(tempDir)).toBe('npm');
  });
});

describe('buildInstallCommand', () => {
  it('generates correct pnpm add command', () => {
    expect(buildInstallCommand('pnpm', '@brewsite/diagram')).toBe('pnpm add @brewsite/diagram');
  });

  it('generates correct pnpm add -D command for dev deps', () => {
    expect(buildInstallCommand('pnpm', '@brewsite/claude-author', { dev: true }))
      .toBe('pnpm add -D @brewsite/claude-author');
  });

  it('generates correct npm install command', () => {
    expect(buildInstallCommand('npm', '@brewsite/core')).toBe('npm install @brewsite/core');
  });

  it('generates correct npm --save-dev command', () => {
    expect(buildInstallCommand('npm', '@brewsite/claude-author', { dev: true }))
      .toBe('npm install --save-dev @brewsite/claude-author');
  });

  it('generates correct yarn add command', () => {
    expect(buildInstallCommand('yarn', '@brewsite/diagram')).toBe('yarn add @brewsite/diagram');
  });

  it('generates correct yarn add -D command for dev deps', () => {
    expect(buildInstallCommand('yarn', '@brewsite/claude-author', { dev: true }))
      .toBe('yarn add -D @brewsite/claude-author');
  });
});
